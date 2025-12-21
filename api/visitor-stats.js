// /api/visitor-stats.js
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return res.status(500).json({ ok: false, error: "Missing env vars" });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { count, error } = await sb
      .from("unique_visitors")
      .select("*", { count: "exact", head: true });

    if (error) return res.status(500).json({ ok: false, error: error.message });

    res.status(200).json({ ok: true, unique_visitors: count || 0 });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "error" });
  }
};
