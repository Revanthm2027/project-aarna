// /api/track.js
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

function getIP(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  return req.socket?.remoteAddress || "";
}

module.exports = async (req, res) => {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const SALT = process.env.VISITOR_SALT;

    if (!SUPABASE_URL || !SERVICE_ROLE || !SALT) {
      return res.status(500).json({ ok: false, error: "Missing env vars" });
    }

    const ip = getIP(req);
    if (!ip) return res.status(200).json({ ok: true, skipped: true });

    const hash = crypto.createHash("sha256").update(ip + SALT).digest("hex");

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // insert once (primary key prevents duplicates)
    const { error } = await sb
      .from("unique_visitors")
      .upsert({ ip_hash: hash }, { onConflict: "ip_hash" });

    if (error) return res.status(500).json({ ok: false, error: error.message });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || "error" });
  }
};
