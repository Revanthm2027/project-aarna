// js/main.js
(function () {
  "use strict";

  // ---------- tiny toast ----------
  function toast(msg, type = "info") {
    let root = document.getElementById("toast-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "toast-root";
      root.style.position = "fixed";
      root.style.right = "16px";
      root.style.bottom = "16px";
      root.style.zIndex = "9999";
      root.style.display = "flex";
      root.style.flexDirection = "column";
      root.style.gap = "10px";
      document.body.appendChild(root);
    }

    const el = document.createElement("div");
    el.textContent = msg;
    el.style.padding = "12px 14px";
    el.style.borderRadius = "12px";
    el.style.maxWidth = "320px";
    el.style.backdropFilter = "blur(10px)";
    el.style.border = "1px solid rgba(255,255,255,0.15)";
    el.style.background =
      type === "error"
        ? "rgba(120, 30, 30, 0.55)"
        : type === "success"
        ? "rgba(20, 90, 50, 0.55)"
        : "rgba(20, 30, 60, 0.55)";
    el.style.color = "rgba(255,255,255,0.92)";
    el.style.boxShadow = "0 10px 35px rgba(0,0,0,0.35)";
    el.style.fontSize = "14px";
    el.style.lineHeight = "1.3";

    root.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity 250ms ease";
      setTimeout(() => el.remove(), 280);
    }, 2400);
  }

  // ---------- theme toggle ----------
  const themeBtn = document.getElementById("theme-toggle");
  const themeIcon = themeBtn ? themeBtn.querySelector(".theme-icon") : null;

  function setTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("aarna_theme", t);
    if (themeIcon) themeIcon.textContent = t === "dark" ? "☾" : "☀";
  }

  const savedTheme = localStorage.getItem("aarna_theme");
  if (savedTheme) setTheme(savedTheme);

  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme") || "dark";
      setTheme(cur === "dark" ? "light" : "dark");
    });
  }

  // ---------- mobile nav ----------
  const navToggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector(".nav-links");
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      navLinks.classList.toggle("open");
      navToggle.classList.toggle("open");
    });

    navLinks.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        navLinks.classList.remove("open");
        navToggle.classList.remove("open");
      });
    });
  }

  // ---------- VISITOR TRACK (unique IP forever; backend dedupes) ----------
  (async function trackOnce() {
    try {
      // reduce spam calls from the same browser
      const key = "aarna_track_sent_v1";
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");

      await fetch(`/api/track?path=${encodeURIComponent(location.pathname)}`, {
        method: "GET",
        cache: "no-store",
      });
    } catch (_) {
      // silent
    }
  })();

  // ---------- Supabase helper ----------
  function getSb() {
    return window.sb || null;
  }

  // ---------- CONTACT FORM ----------
  const contactForm = document.getElementById("contact-form");
  let submitting = false;

  if (contactForm) {
    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (submitting) return;

      const sb = getSb();
      if (!sb) {
        toast("Backend not configured. Check Supabase keys.", "error");
        return;
      }

      const fd = new FormData(contactForm);
      const name = (fd.get("name") || "").toString().trim();
      const email = (fd.get("email") || "").toString().trim().toLowerCase();
      const message = (fd.get("message") || "").toString().trim();
      const newsletter = !!document.getElementById("newsletter-optin")?.checked;

      if (!name || !email || !message) {
        toast("Please fill all fields.", "error");
        return;
      }

      submitting = true;
      const btn = contactForm.querySelector('button[type="submit"]');
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = "0.85";
        btn.textContent = "Sending...";
      }

      try {
        // 1) store message
        const { error: msgErr } = await sb.from("contact_messages").insert([
          {
            name,
            email,
            message,
            status: "open",
            newsletter_opt_in: newsletter,
            source_path: location.pathname,
          },
        ]);

        if (msgErr) throw msgErr;

        // 2) optionally store newsletter (upsert by email)
        if (newsletter) {
          const { error: nErr } = await sb
            .from("newsletter_subscribers")
            .upsert(
              [{ email, name, source: "contact_form" }],
              { onConflict: "email" }
            );

          if (nErr) {
            // newsletter failure shouldn't block message success
            console.warn("[AARNA] newsletter upsert failed:", nErr);
          }
        }

        contactForm.reset();
        toast("Your message has been received.", "success");
      } catch (err) {
        console.error(err);
        toast("Failed to send. Try again in a moment.", "error");
      } finally {
        submitting = false;
        if (btn) {
          btn.disabled = false;
          btn.style.opacity = "1";
          btn.textContent = "Submit";
        }
      }
    });
  }

  // ---------- EXPERIMENTS: render published rows if available ----------
  (async function loadExperiments() {
    const sb = getSb();
    const grid = document.querySelector(".experiments-grid");
    if (!sb || !grid) return;

    // keep existing HTML as fallback
    const fallback = grid.innerHTML;

    try {
      const { data, error } = await sb
        .from("experiments")
        .select("*")
        .eq("is_published", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return;

      grid.innerHTML = "";
      data.forEach((x) => {
        const card = document.createElement("article");
        card.className = "experiment-card hover-float";

        const status = document.createElement("span");
        status.className = "experiment-status";
        status.textContent = x.status_label || "Live";

        const h = document.createElement("h3");
        h.textContent = x.title || "Experiment";

        const p = document.createElement("p");
        p.textContent = x.description || "";

        card.appendChild(status);
        card.appendChild(h);
        card.appendChild(p);

        grid.appendChild(card);
      });
    } catch (e) {
      console.warn("[AARNA] experiments load failed:", e);
      grid.innerHTML = fallback;
    }
  })();
})();
