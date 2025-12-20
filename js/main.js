/* /js/main.js */
(function () {
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

  function normalizeImagePaths(row) {
    const max = 4;

    if (Array.isArray(row.image_paths)) return row.image_paths.filter(Boolean).slice(0, max);

    if (typeof row.image_paths === "string" && row.image_paths.trim()) {
      const s = row.image_paths.trim();
      if (s.startsWith("{") && s.endsWith("}")) {
        const inner = s.slice(1, -1).trim();
        if (!inner) return [];
        return inner
          .split(",")
          .map((x) => x.trim().replace(/^"+|"+$/g, ""))
          .filter(Boolean)
          .slice(0, max);
      }
      return s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, max);
    }

    if (row.image_path) return [row.image_path];
    return [];
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
    const dots = urls
      .map(
        (_, i) =>
          `<button class="exp-dot ${i === 0 ? "active" : ""}" type="button" aria-label="Go to image ${i + 1}"></button>`
      )
      .join("");

    return `
      <div class="exp-carousel" data-carousel="live">
        <div class="exp-track">
          ${urls
            .map(
              (u) => `
            <div class="exp-slide">
              <img src="${u}" alt="${alt}" loading="lazy" decoding="async">
            </div>
          `
            )
            .join("")}
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

    window.addEventListener("resize", () => requestAnimationFrame(update), { passive: true });

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
      .select("id,title,description,status,is_published,image_paths,image_path,image_alt,created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[AARNA] experiments query error:", error.message);
      return;
    }

    if (!data || !data.length) {
      grid.innerHTML = `<p style="opacity:.75;">No experiments published yet.</p>`;
      return;
    }

    grid.innerHTML = data
      .map((x) => {
        const status = x.status ? `<span class="experiment-status">${x.status}</span>` : "";
        const paths = normalizeImagePaths(x);
        const urls = paths.map((p) => getPublicImageUrl(sb, "experiments", p)).filter(Boolean);
        const alt = (x.image_alt || x.title || "Experiment image").replace(/"/g, "&quot;");

        return `
          <article class="experiment-card hover-float">
            ${status}
            ${carouselHtml(urls, alt)}
            <h3>${x.title || ""}</h3>
            <p>${x.description || ""}</p>
          </article>
        `;
      })
      .join("");

    initAllCarousels();
  }

  async function bootSupabaseFeatures() {
    if (!window.sb) return;
    await renderExperiments();
  }

  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initMobileNav();

    // run once if already ready
    if (window.sb) bootSupabaseFeatures();

    // run when Supabase becomes ready
    window.addEventListener("aarna:supabase-ready", () => bootSupabaseFeatures(), { once: true });
  });
})();
