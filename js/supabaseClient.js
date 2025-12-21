// /js/supabaseClient.js
(function () {
  const SUPABASE_URL = "https://bqrmoclpumoshbubchls.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcm1vY2xwdW1vc2hidWJjaGxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NTY1NzIsImV4cCI6MjA4MTEzMjU3Mn0.Kg6CHndX9C-8SBH0m1djFuHQDkSbrVfBM9i5q7WTYc4";

  function ready() {
    if (!window.supabase) return false;

    try {
      window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true }
      });

      console.log("[AARNA] Supabase client ready");
      window.dispatchEvent(new Event("aarna:supabase-ready"));
      return true;
    } catch (e) {
      console.error("[AARNA] Failed creating Supabase client:", e);
      return false;
    }
  }

  // If supabase-js hasn’t loaded yet, wait a bit
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (ready()) clearInterval(timer);
    if (tries > 150) { // ~9s
      clearInterval(timer);
      console.error("[AARNA] supabase-js not loaded. Check script order + network.");
    }
  }, 60);
})();
