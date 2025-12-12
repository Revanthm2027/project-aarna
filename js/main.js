// js/main.js
document.addEventListener("DOMContentLoaded", () => {
  // Theme
  const root = document.documentElement;
  const themeToggle = document.getElementById("theme-toggle");
  const THEME_KEY = "aarna-theme";

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    const icon = themeToggle?.querySelector(".theme-icon");
    if (icon) icon.textContent = theme === "light" ? "☀︎" : "☾";
  }

  applyTheme(localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark");

  themeToggle?.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });

  // Toast
  function toast(message, type = "success") {
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.textContent = message;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 220);
    }, 2200);
  }

  // Smooth scroll
  const navLinks = Array.from(document.querySelectorAll(".nav-link"));
  const sections = navLinks.map((l) => document.querySelector(l.getAttribute("href"))).filter(Boolean);
  const navbar = document.querySelector(".navbar");
  const navOffset = () => (navbar ? navbar.offsetHeight + 6 : 70);

  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");
      if (!href || !href.startsWith("#")) return;
      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();
      const rect = target.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      window.scrollTo({ top: rect.top + scrollTop - navOffset(), behavior: "smooth" });
    });
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const id = entry.target.getAttribute("id");
        const match = navLinks.find((l) => l.getAttribute("href") === `#${id}`);
        if (entry.isIntersecting && match) {
          navLinks.forEach((l) => l.classList.remove("active"));
          match.classList.add("active");
        }
      });
    },
    { threshold: 0.45 }
  );
  sections.forEach((s) => observer.observe(s));

  // Contact form
  const form = document.getElementById("contact-form");
  const newsletterOpt = document.getElementById("newsletter-optin");
  const submitBtn = form?.querySelector('button[type="submit"]');

  if (!form) return;

  let inFlight = false;

  form.addEventListener(
    "submit",
    async (e) => {
      e.preventDefault();
      if (inFlight) return;

      const sb = window.sb;
      if (!sb) {
        toast("Backend not configured. Check Supabase keys.", "error");
        return;
      }

      inFlight = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.dataset.originalText = submitBtn.textContent || "Submit";
        submitBtn.textContent = "Sending…";
      }

      try {
        const fd = new FormData(form);

        const name = String(fd.get("name") || "").trim();
        const email = String(fd.get("email") || "").trim().toLowerCase();
        const message = String(fd.get("message") || "").trim();

        if (!name || !email || !message) {
          toast("Please fill all fields.", "error");
          return;
        }

        const { error } = await sb.from("contacts").insert([{ name, email, message, status: "new" }]);
        if (error) {
          console.error(error);
          toast("Failed to send. Try again.", "error");
          return;
        }

        if (newsletterOpt?.checked) {
          const { error: nerr } = await sb.from("newsletter_subscribers").insert([{ email }]);
          // ignore duplicate subscriber
          if (nerr && nerr.code !== "23505") console.warn(nerr);
        }

        form.reset();
        if (newsletterOpt) newsletterOpt.checked = false;
        toast("Your message has been received.", "success");
      } finally {
        inFlight = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = submitBtn.dataset.originalText || "Submit";
        }
      }
    },
    { capture: true }
  );
});
