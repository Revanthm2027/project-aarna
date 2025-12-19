/* /api/track.js */
const crypto = require("crypto");

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  return req.socket?.remoteAddress || "";
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

module.exports = async (req, res) => {
  // CORS (safe)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).json({ ok: true });
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SALT = process.env.AARNA_VISITOR_SALT || "change-me";

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
  }

  const ip = getClientIp(req);
  if (!ip) return res.status(200).json({ ok: true, skipped: true });

  const ipHash = sha256Hex(`${SALT}:${ip}`);
  const now = new Date().toISOString();

  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/unique_visitors`);
    url.searchParams.set("on_conflict", "ip_hash");

    const r = await fetch(url.toString(), {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify([{ ip_hash: ipHash, last_seen: now }]),
    });

    const text = await r.text();
    if (!r.ok) return res.status(500).json({ error: text });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "track failed" });
  }
};
