// api/visitor-stats.js
// Returns ONE number: total unique visitors (unique IP hashes) all-time.

module.exports = async (req, res) => {
  try {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return res.status(500).json({
        ok: false,
        error: "Missing env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY",
      });
    }

    // Use count via Content-Range header
    const url = `${SUPABASE_URL}/rest/v1/unique_visitors?select=ip_hash`;

    const r = await fetch(url, {
      method: "GET",
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(500).json({ ok: false, error: t });
    }

    const contentRange = r.headers.get("content-range") || "";
    const total = Number((contentRange.split("/")[1] || "0").trim()) || 0;

    return res.status(200).json({ ok: true, uniqueVisitors: total });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
