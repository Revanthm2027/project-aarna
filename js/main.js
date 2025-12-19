/* /js/main.js */
(function () {
  // ---------- tiny toast ----------
  function toast(msg) {
    let wrap = document.getElementById("toasts");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "toasts";
      wrap.style.position = "fixed";
      wrap.style.right = "16px";
      wrap.style.bottom = "16px";
      wrap.style.zIndex = "9999";
      wrap.style.display = "flex";
      wrap.style.flexDirection = "column";
      wrap.style.gap = "10px";
      document.body.appendChild(wrap);
    }
    const t = document.createElement("div");
    t.style.padding = "12px 14px";
    t.style.borderRadius = "12px";
    t.style.border = "1px solid rgba(255,255,255,0.18)";
    t.style.background = "rgba(10, 18, 40, 0.92)";
    t.style.backdropFilter = "blur(10px)";
    t.style.color = "white";
    t.style.maxWidth = "420px";
    t.style.boxShadow = "0 10px 24px rgba(0,0,0,0.25)";
    t.style.fontSize = "14px";
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  // ---------- theme ----------
  function initTheme() {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;

    const root = document.documentElement;
    const saved = localStorage.getItem("aarna_theme");
    if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);

    btn.addEventListener("click", () => {
      const cur = root.getAttribute("data-theme") || "dark";
      const next = cur === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem("aarna_theme", next);
    });
  }

  // ---------- mobile nav ----------
  function initMobileNav() {
    const toggle = document.querySelector(".nav-toggle");
    const navLinks = document.querySelector(".nav-links");
    if (!toggle || !navLinks) return;

    toggle.addEventListener("click", () => {
      navLinks.classList.toggle("open");
      toggle.classList.toggle("open");
    });

    navLinks.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        navLinks.classList.remove("open");
        toggle.classList.remove("open");
      });
    });
  }

  // ---------- contact form (prevents multi-click duplicates) ----------
  function initContactForm() {
    const form = document.getElementById("contact-form");
    if (!form) return;

    let inFlight = false;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (inFlight) return;

      const sb = window.sb;
      if (!sb) return toast("Backend not configured. Check Supabase keys.");

      const fd = new FormData(form);
      const name = String(fd.get("name") || "").trim();
      const email = String(fd.get("email") || "").trim();
      const message = String(fd.get("message") || "").trim();
      const newsletterOptin = !!document.getElementById("newsletter-optin")?.checked;

      if (!name || !email || !message) return toast("Please fill all fields.");

      const submitBtn = form.querySelector("button[type='submit']");
      inFlight = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting…";
      }

      try {
        // message row (allow multiple messages from same email)
        const { error } = await sb.from("contact_messages").insert([
          {
            name,
            email,
            message,
            newsletter_optin: newsletterOptin,
            status: "open",
          },
        ]);

        if (error) throw error;

        // newsletter row (dedup by primary key email if you use the SQL below)
        if (newsletterOptin) {
          await sb.from("newsletter_subscribers").upsert([{ email }], { onConflict: "email" });
        }

        toast("Message received. We’ll get back to you.");
        form.reset();
      } catch (err) {
        toast(err?.message || "Submit failed.");
      } finally {
        inFlight = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Submit";
        }
      }
    });
  }

  // ---------- experiments render from Supabase (published only) ----------
  async function renderExperiments() {
    const grid = document.querySelector(".experiments-grid");
    if (!grid) return;
    const sb = window.sb;
    if (!sb) return;

    const { data, error } = await sb
      .from("experiments")
      .select("*")
      .eq("is_published", true)
      .order("sort_order", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: false });

    if (error || !data) return;

    // Replace grid with live data
    if (!data.length) {
      grid.innerHTML = `<p style="opacity:.75;">No experiments published yet.</p>`;
      return;
    }

    grid.innerHTML = data
      .map((x) => {
        const status = x.status ? `<span class="experiment-status">${x.status}</span>` : "";
        const link =
          x.link_url
            ? `<p style="margin-top:10px;"><a href="${x.link_url}" target="_blank" rel="noopener noreferrer">Read more</a></p>`
            : "";

        return `
          <article class="experiment-card hover-float">
            ${status}
            <h3>${String(x.title || "")}</h3>
            <p>${String(x.description || "")}</p>
            ${link}
          </article>
        `;
      })
      .join("");
  }

  // ---------- unique IP tracking (lifetime unique) ----------
  async function trackUniqueVisit() {
    // avoid counting admin page
    if (location.pathname.startsWith("/admin")) return;

    // reduce calls per browser (server still dedups by IP)
    const key = "aarna_track_sent_v1";
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");

    try {
      await fetch(`/api/track?path=${encodeURIComponent(location.pathname)}&t=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
      });
    } catch (_) {
      // ignore
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initMobileNav();
    initContactForm();
    renderExperiments();
    trackUniqueVisit();
  });
})();
