// js/supabaseClient.js
(function () {
  const SUPABASE_URL = "https://bqrmoclpumoshbubchls.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcm1vY2xwdW1vc2hidWJjaGxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NTY1NzIsImV4cCI6MjA4MTEzMjU3Mn0.Kg6CHndX9C-8SBH0m1djFuHQDkSbrVfBM9i5q7WTYc4"; // keep your current key here

  const lib = window.supabase || window.Supabase || null;

  if (!lib) {
    console.error("[AARNA] Supabase CDN not loaded. Check script tag URL/order.");
    return;
  }

  try {
    window.sb = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.__AARNA_SB_READY = true;
    console.log("[AARNA] Supabase client ready");
  } catch (e) {
    console.error("[AARNA] Supabase createClient failed:", e);
  }
})();
