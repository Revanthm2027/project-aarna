// api/visitor-stats.js
export default async function handler(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Missing env: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
    }

    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/visitor_stats`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });

    const text = await r.text();
    res.setHeader("Cache-Control", "no-store");

    if (!r.ok) return res.status(r.status).json({ error: text });

    // Supabase returns JSON text; pass it through cleanly
    return res.status(200).send(text);
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
