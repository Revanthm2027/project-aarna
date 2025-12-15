// js/main.js
document.addEventListener("DOMContentLoaded", () => {
  // wait for window.sb (covers slow script load / caching edge cases)
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

  // Toast
  function toast(msg, type = "info") {
    let el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.style.position = "fixed";
      el.style.right = "16px";
      el.style.bottom = "16px";
      el.style.zIndex = "9999";
      el.style.padding = "12px 14px";
      el.style.borderRadius = "14px";
      el.style.border = "1px solid rgba(148,163,184,0.35)";
      el.style.background = "rgba(2,6,23,0.9)";
      el.style.color = "white";
      el.style.backdropFilter = "blur(10px)";
      el.style.maxWidth = "320px";
      el.style.fontSize = "0.95rem";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.boxShadow =
      type === "error"
        ? "0 0 0 1px rgba(239,68,68,0.35), 0 18px 50px rgba(239,68,68,0.15)"
        : "0 0 0 1px rgba(56,189,248,0.25), 0 18px 50px rgba(56,189,248,0.12)";
    el.style.opacity = "1";
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.style.opacity = "0"), 2200);
  }

  const esc = (s) =>
    String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");

  // Load experiments into live site
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

  // boot
  (async () => {
    const sb = await waitForSb();
    await loadExperiments(sb);
  })();
});
