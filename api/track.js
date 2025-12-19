// api/track.js
// Stores exactly ONE record per unique IP (hashed with a secret salt).
// No repeats, ever.

const crypto = require("crypto");

module.exports = async (req, res) => {
  try {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const VISITOR_SALT = process.env.VISITOR_SALT;

    if (!SUPABASE_URL || !SERVICE_ROLE || !VISITOR_SALT) {
      return res.status(500).json({
        ok: false,
        error: "Missing env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / VISITOR_SALT",
      });
    }

    // Vercel forwards IP here most reliably
    const fwd =
      (req.headers["x-vercel-forwarded-for"] ||
        req.headers["x-forwarded-for"] ||
        "")
        .toString()
        .split(",")[0]
        .trim();

    const ip =
      fwd ||
      (req.socket && req.socket.remoteAddress) ||
      "0.0.0.0";

    const ip_hash = crypto
      .createHash("sha256")
      .update(`${ip}:${VISITOR_SALT}`)
      .digest("hex");

    // Insert once. If already exists, ignore (no duplicate count).
    const url = `${SUPABASE_URL}/rest/v1/unique_visitors?on_conflict=ip_hash`;

    const r = await fetch(url, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates",
      },
      body: JSON.stringify({ ip_hash }),
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(500).json({ ok: false, error: t });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
