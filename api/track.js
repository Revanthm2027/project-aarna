export default async function handler(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Missing env: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
    }

    const path = (req.query?.path || "/").toString().slice(0, 200);
    const vidRaw = (req.query?.vid || "").toString().slice(0, 120);

    // fallback fingerprint (if no vid)
    const ip =
      (req.headers["x-forwarded-for"] || "")
        .toString()
        .split(",")[0]
        .trim() || "unknown";
    const ua = (req.headers["user-agent"] || "").toString().slice(0, 300);

    const key = vidRaw ? `vid:${vidRaw}` : `ipua:${ip}|${ua}`;

    const payload = {
      path,
      ip_hash: await sha256(key),
      user_agent: ua,
      visited_at: new Date().toISOString(),
    };

    const r = await fetch(`${SUPABASE_URL}/rest/v1/page_visits`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const err = await r.text();
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
