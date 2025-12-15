// js/main.js
document.addEventListener("DOMContentLoaded", () => {
  // ---- Visitor tracking (non-blocking, per-browser unique) ----
  try {
    const KEY = "aarna_vid";
    let vid = localStorage.getItem(KEY);
    if (!vid) {
      const c = globalThis.crypto;
      vid = c?.randomUUID ? c.randomUUID() : `vid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(KEY, vid);
    }

    fetch(
      `/api/track?path=${encodeURIComponent(location.pathname)}&vid=${encodeURIComponent(vid)}`,
      { cache: "no-store", keepalive: true }
    ).catch(() => {});
  } catch {}

  // ---- wait for window.sb (covers slow load / caching edge cases) ----
  const waitForSb = (ms = 2500) =>
    new Promise((resolve) => {
      const t0 = Date.now();
      const tick = () => {
        if (window.sb) return resolve(window.sb);
        if (Date.now() - t0 > ms) return resolve(null);
        setTimeout(tick, 50);
      };
      tick();
    });

  // Theme
  const root = document.documentElement;
  const THEME_KEY = "aarna-theme";
  const themeToggle = document.getElementById("theme-toggle");
  const savedTheme = localStorage.getItem(THEME_KEY) || "dark";
  root.setAttribute("data-theme", savedTheme);

  function updateThemeIcon() {
    const icon = themeToggle?.querySelector(".theme-icon");
    if (!icon) return;
    icon.textContent = root.getAttribute("data-theme") === "light" ? "☀︎" : "☾";
  }
  updateThemeIcon();

  themeToggle?.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
    updateThemeIcon();
  });

  // Mobile nav
  const navToggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector(".nav-links");
  navToggle?.addEventListener("click", () => {
    navLinks?.classList.toggle("open");
    navToggle?.classList.toggle("open");
  });
  document.querySelectorAll(".nav-link").forEach((a) => {
    a.addEventListener("click", () => {
      navLinks?.classList.remove("open");
      navToggle?.classList.remove("open");
    });
  });

  const esc = (s) =>
    String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");

  // Experiments: load from Supabase
  async function loadExperiments(sb) {
    const grid = document.getElementById("experiments-grid");
    if (!grid) return;

    if (!sb) {
      grid.innerHTML = `
        <article class="experiment-card hover-float">
          <span class="experiment-status">Offline</span>
          <h3>Experiments not configured</h3>
          <p>Supabase client not available on this page.</p>
        </article>`;
      return;
    }

    const { data, error } = await sb
      .from("experiments")
      .select("id,title,status,summary,location,sort_order,is_published,created_at")
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      grid.innerHTML = `
        <article class="experiment-card hover-float">
          <span class="experiment-status">Error</span>
          <h3>Could not load experiments</h3>
          <p>${esc(error.message)}</p>
        </article>`;
      return;
    }

    if (!data || data.length === 0) {
      grid.innerHTML = `
        <article class="experiment-card hover-float">
          <span class="experiment-status">Coming soon</span>
          <h3>No experiments published yet</h3>
          <p>Add experiments from /admin → Experiments.</p>
        </article>`;
      return;
    }

    grid.innerHTML = data
      .map((e) => {
        const status = e.status || "Planned";
        const title = e.title || "Untitled";
        const loc = e.location ? ` · ${e.location}` : "";
        return `
          <article class="experiment-card hover-float">
            <span class="experiment-status">${esc(status)}</span>
            <h3>${esc(title)}${esc(loc)}</h3>
            <p>${esc(e.summary || "")}</p>
          </article>`;
      })
      .join("");
  }

  (async () => {
    const sb = await waitForSb();
    await loadExperiments(sb);
  })();
});
