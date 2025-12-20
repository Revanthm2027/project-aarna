// /js/supabaseClient.js
(function () {
  const SUPABASE_URL = "https://bqrmoclpumoshbubchls.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcm1vY2xwdW1vc2hidWJjaGxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NTY1NzIsImV4cCI6MjA4MTEzMjU3Mn0.Kg6CHndX9C-8SBH0m1djFuHQDkSbrVfBM9i5q7WTYc4";

  function boot() {
    if (!window.supabase) return false;

    window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.__AARNA_SB_READY__ = true;
    window.dispatchEvent(new Event("aarna:supabase-ready"));
    console.log("[AARNA] Supabase client ready");
    return true;
  }

  if (boot()) return;

  // retry a few times if CDN is late
  let tries = 0;
  const t = setInterval(() => {
    tries += 1;
    if (boot() || tries >= 80) clearInterval(t); // stops automatically
  }, 50);
})();
