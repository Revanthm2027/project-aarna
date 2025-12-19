// api/track.js
export default async function handler(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const IP_HASH_SALT = process.env.IP_HASH_SALT || "aarna_default_salt_change_me";

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Missing env: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
    }

    // Get IP (Vercel / proxies)
    const xff = (req.headers["x-forwarded-for"] || "").toString();
    const rawIp =
      (xff.split(",")[0] || "").trim() ||
      (req.headers["x-real-ip"] || "").toString().trim() ||
      req.socket?.remoteAddress ||
      "";

    // Normalize some common formats
    const ip = rawIp.replace("::ffff:", "").trim();

    // Hash IP with salt (so you don't store raw IP)
    const ip_hash = await sha256(`${IP_HASH_SALT}:${ip}`);

    // Upsert into unique_visitors (one row per IP)
    const now = new Date().toISOString();
    const payload = { ip_hash, last_seen: now, first_seen: now };

    const r = await fetch(`${SUPABASE_URL}/rest/v1/unique_visitors?on_conflict=ip_hash`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const err = await r.text();
      res.setHeader("Cache-Control", "no-store");
      return res.status(r.status).json({ error: err });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}

async function sha256(input) {
  const crypto = await import("crypto");
  return crypto.createHash("sha256").update(input).digest("hex");
}
