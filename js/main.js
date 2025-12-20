/* /js/main.js */
(function () {
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
        const { error } = await sb.from("contact_messages").insert([
          { name, email, message, newsletter_optin: newsletterOptin, status: "open" },
        ]);
        if (error) throw error;

        if (newsletterOptin) {
          // if table doesn't exist, admin will fall back to contact_messages
          try {
            await sb.from("newsletter_subscribers").upsert([{ email }], { onConflict: "email" });
          } catch {}
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

  function getPublicImageUrl(sb, bucket, path) {
    if (!path) return null;
    try {
      const { data } = sb.storage.from(bucket).getPublicUrl(path);
      return data?.publicUrl || null;
    } catch {
      return null;
    }
  }

  function carouselHtml(urls, alt) {
    if (!urls.length) return "";
    const dots = urls.map((_, i) => `<button class="exp-dot ${i===0?"active":""}" type="button" aria-label="Go to image ${i+1}"></button>`).join("");

    return `
      <div class="exp-carousel" data-carousel="live">
        <div class="exp-track">
          ${urls.map((u) => `
            <div class="exp-slide">
              <img src="${u}" alt="${alt}" loading="lazy" decoding="async">
            </div>
          `).join("")}
        </div>
        <div class="exp-dots">${dots}</div>
      </div>
    `;
  }

  function initCarousel(el) {
    const track = el.querySelector(".exp-track");
    const dots = Array.from(el.querySelectorAll(".exp-dot"));
    if (!track || dots.length <= 1) return;

    const update = () => {
      const w = track.clientWidth || 1;
      const idx = Math.round(track.scrollLeft / w);
      dots.forEach((d, i) => d.classList.toggle("active", i === idx));
    };

    track.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });

    dots.forEach((d, i) => {
      d.addEventListener("click", () => {
        const w = track.clientWidth || 1;
        track.scrollTo({ left: i * w, behavior: "smooth" });
      });
    });

    update();
  }

  function initAllCarousels() {
    document.querySelectorAll(".exp-carousel[data-carousel='live']").forEach(initCarousel);
  }

  async function renderExperiments() {
    const grid = document.querySelector(".experiments-grid");
    if (!grid) return;

    const sb = window.sb;
    if (!sb) return;

    const { data, error } = await sb
      .from("experiments")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (error || !data) return;

    if (!data.length) {
      grid.innerHTML = `<p style="opacity:.75;">No experiments published yet.</p>`;
      return;
    }

    grid.innerHTML = data.map((x) => {
      const status = x.status ? `<span class="experiment-status">${x.status}</span>` : "";

      const paths = Array.isArray(x.image_paths) && x.image_paths.length
        ? x.image_paths.slice(0, 4)
        : (x.image_path ? [x.image_path] : []);

      const urls = paths
        .map((p) => getPublicImageUrl(sb, "experiments", p))
        .filter(Boolean);

      const alt = (x.image_alt || x.title || "Experiment image").replace(/"/g, "&quot;");

      return `
        <article class="experiment-card hover-float">
          ${status}
          ${carouselHtml(urls, alt)}
          <h3>${x.title || ""}</h3>
          <p>${x.description || ""}</p>
        </article>
      `;
    }).join("");

    initAllCarousels();
  }

  async function trackUniqueVisit() {
    if (location.pathname.startsWith("/admin")) return;
    const key = "aarna_track_sent_v1";
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    try {
      await fetch(`/api/track?path=${encodeURIComponent(location.pathname)}&t=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
      });
    } catch {}
  }

  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initMobileNav();
    initContactForm();
    renderExperiments();
    trackUniqueVisit();
  });
})();
