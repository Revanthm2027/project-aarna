// js/supabaseClient.js
(function () {
  const SUPABASE_URL = "https://bqrmoclpumoshbubchls.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcm1vY2xwdW1vc2hidWJjaGxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NTY1NzIsImV4cCI6MjA4MTEzMjU3Mn0.Kg6CHndX9C-8SBH0m1djFuHQDkSbrVfBM9i5q7WTYc4";

  const g = window.supabase || window.Supabase || window.supabaseJs;

  if (!g || typeof g.createClient !== "function") {
    console.error("[AARNA] supabase-js not loaded. Check index.html script order/path.");
    return;
  }

  window.sb = g.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  window.__AARNA_SB_READY__ = true;
  console.log("[AARNA] Supabase client ready");
})();
