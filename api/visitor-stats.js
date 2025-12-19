/* /api/visitor-stats.js */
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
  }

  try {
    // Count rows via Content-Range header
    const url = new URL(`${SUPABASE_URL}/rest/v1/unique_visitors`);
    url.searchParams.set("select", "ip_hash");

    const r = await fetch(url.toString(), {
      method: "GET",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
    });

    const body = await r.text();
    if (!r.ok) return res.status(500).json({ error: body });

    const cr = r.headers.get("content-range") || "";
    // formats: "0-0/12" or "*/0"
    const m = cr.match(/\/(\d+)\s*$/);
    const count = m ? Number(m[1]) : 0;

    return res.status(200).json({ unique_visitors: count });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "visitor-stats failed" });
  }
};
