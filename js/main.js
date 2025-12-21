// /js/main.js
(function () {
  function $(sel, root = document) { return root.querySelector(sel); }
  function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type === "success" ? "toast-success" : ""} ${type === "error" ? "toast-error" : ""}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => toast.classList.remove("show"), 2600);
    setTimeout(() => toast.remove(), 3200);
  }

  function waitForSb(timeoutMs = 9000) {
    return new Promise((resolve, reject) => {
      if (window.sb) return resolve(window.sb);
      const t0 = Date.now();
      const onReady = () => { cleanup(); resolve(window.sb); };
      const timer = setInterval(() => {
        if (window.sb) onReady();
        if (Date.now() - t0 > timeoutMs) { cleanup(); reject(new Error("window.sb missing")); }
      }, 60);
      function cleanup() {
        clearInterval(timer);
        window.removeEventListener("aarna:supabase-ready", onReady);
      }
      window.addEventListener("aarna:supabase-ready", onReady, { once: true });
    });
  }

  // Theme toggle (works with your current CSS variables)
  function initTheme() {
    const btn = $("#theme-toggle");
    if (!btn) return;
    const html = document.documentElement;
    const saved = localStorage.getItem("aarna-theme");
    if (saved) html.setAttribute("data-theme", saved);

    btn.addEventListener("click", () => {
      const cur = html.getAttribute("data-theme") || "dark";
      const next = cur === "dark" ? "light" : "dark";
      html.setAttribute("data-theme", next);
      localStorage.setItem("aarna-theme", next);
    });
  }

  // Mobile nav toggle (your CSS supports .nav-links.open)
  function initMobileNav() {
    const btn = $(".nav-toggle");
    const links = $(".nav-links");
    if (!btn || !links) return;
    btn.addEventListener("click", () => links.classList.toggle("open"));
    $all(".nav-link").forEach((a) => a.addEventListener("click", () => links.classList.remove("open")));
  }

  // Unique visitor tracking (server stores unique IP hash once)
  async function trackVisitor() {
    try {
      if (sessionStorage.getItem("aarna_tracked")) return;
      sessionStorage.setItem("aarna_tracked", "1");
      await fetch(`/api/track?path=${encodeURIComponent(location.pathname || "/")}`, { cache: "no-store" });
    } catch {}
  }

  // ---- Carousel HTML using YOUR old classnames ----
  function buildCarousel(urls) {
    if (!urls || urls.length === 0) return "";

    const slides = urls.map((u) => `
      <div class="exp-slide">
        <img src="${u}" alt="Experiment image" loading="lazy" />
      </div>
    `).join("");

    const dots = urls.map((_, i) => `
      <button class="exp-dot ${i === 0 ? "active" : ""}" type="button" aria-label="Go to image ${i + 1}" data-i="${i}"></button>
    `).join("");

    return `
      <div class="exp-carousel">
        <div class="exp-track">${slides}</div>
        <div class="exp-dots">${dots}</div>
      </div>
    `;
  }

  function wireCarousel(card) {
    const track = $(".exp-track", card);
    const dots = $all(".exp-dot", card);
    if (!track || dots.length === 0) return;

    function setActive(idx) {
      dots.forEach((d, i) => d.classList.toggle("active", i === idx));
    }

    dots.forEach((d) => {
      d.addEventListener("click", () => {
        const i = Number(d.getAttribute("data-i") || 0);
        const w = track.clientWidth || 1;
        track.scrollTo({ left: i * w, behavior: "smooth" });
        setActive(i);
      });
    });

    track.addEventListener("scroll", () => {
      const w = track.clientWidth || 1;
      const idx = Math.round(track.scrollLeft / w);
      setActive(Math.max(0, Math.min(dots.length - 1, idx)));
    });
  }

  async function loadExperiments() {
    const container = document.getElementById("experiments-list");
    if (!container) return;

    let sb;
    try {
      sb = await waitForSb();
    } catch {
      container.innerHTML = `<p class="experiments-note">Backend not configured. Check Supabase keys.</p>`;
      return;
    }

    const BUCKET = "experiments";

    // IMPORTANT: include summary (your DB uses it)
    const { data, error } = await sb
      .from("experiments")
      .select("id,title,status,summary,description,image_paths,is_published,created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (error) {
      container.innerHTML = `<p class="experiments-note">Failed to load experiments.</p>`;
      return;
    }

    if (!data?.length) {
      container.innerHTML = `<p class="experiments-note">No experiments published yet.</p>`;
      return;
    }

    container.innerHTML = data.map((x) => {
      const paths = Array.isArray(x.image_paths) ? x.image_paths.slice(0, 4) : [];
      const urls = paths.map((p) => {
        const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(p);
        return pub?.publicUrl || "";
      }).filter(Boolean);

      const text = (x.summary || x.description || "");
      return `
        <article class="experiment-card hover-float">
          <span class="experiment-status">${(x.status || "Published")}</span>
          <h3>${x.title}</h3>
          <p>${text}</p>
          ${buildCarousel(urls)}
        </article>
      `;
    }).join("");

    $all(".experiment-card", container).forEach(wireCarousel);
  }

  function initContactForm() {
    const form = document.getElementById("contact-form");
    if (!form) return;

    let inFlight = false;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (inFlight) return;
      inFlight = true;

      const btn = form.querySelector('button[type="submit"]');
      const prev = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Sending...";

      try {
        const sb = await waitForSb();

        const name = form.elements.name.value.trim();
        const email = form.elements.email.value.trim();
        const message = form.elements.message.value.trim();
        const newsletter = !!document.getElementById("newsletter-optin")?.checked;

        const { error } = await sb.from("contact_messages").insert([{
          name, email, message,
          newsletter_optin: newsletter,
          status: "open"
        }]);
        if (error) throw new Error(error.message || "Failed to submit");

        if (newsletter) {
          await sb.from("newsletter_signups").upsert({ email }, { onConflict: "email" });
        }

        form.reset();
        showToast("Your message has been received.", "success");
      } catch (err) {
        showToast(err?.message || "Failed to send message.", "error");
      } finally {
        inFlight = false;
        btn.disabled = false;
        btn.textContent = prev;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initMobileNav();
    initContactForm();
    trackVisitor();
    loadExperiments();
  });
})();
