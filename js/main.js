// Navigation, smooth scroll with navbar offset, active link highlight, theme toggle, and contact form demo
document.addEventListener("DOMContentLoaded", () => {
  const navLinks = Array.from(document.querySelectorAll(".nav-link"));
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".nav-links");
  const navbar = document.querySelector(".navbar");

  // Calculate navbar height for scroll offset
  function getNavOffset() {
    return navbar ? navbar.offsetHeight + 4 : 64; // small buffer
  }

  // Mobile nav toggle
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      nav.classList.toggle("open");
    });

    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("open");
      });
    });
  }

  // Smooth scroll behavior with offset so headings are fully visible
  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      const targetId = link.getAttribute("href");
      if (!targetId || !targetId.startsWith("#")) return;

      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const navOffset = getNavOffset();
        const rect = target.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetY = rect.top + scrollTop - navOffset;

        window.scrollTo({
          top: targetY,
          behavior: "smooth",
        });
      }
    });
  });

  // Active nav highlighting on scroll (no animation classes to avoid lag)
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const id = entry.target.getAttribute("id");
        if (!id) return;

        const matchingLink = navLinks.find(
          (link) => link.getAttribute("href") === `#${id}`
        );

        if (entry.isIntersecting && matchingLink) {
          navLinks.forEach((l) => l.classList.remove("active"));
          matchingLink.classList.add("active");
        }
      });
    },
    {
      threshold: 0.45,
    }
  );

  sections.forEach((section) => observer.observe(section));

  // Theme toggle (light / dark)
  const root = document.documentElement;
  const themeToggle = document.getElementById("theme-toggle");
  const THEME_KEY = "aarna-theme";

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    if (themeToggle) {
      const iconSpan = themeToggle.querySelector(".theme-icon");
      if (iconSpan) {
        iconSpan.textContent = theme === "light" ? "☀︎" : "☾";
      }
    }
  }

  const storedTheme = localStorage.getItem(THEME_KEY);
  const initialTheme =
    storedTheme === "light" || storedTheme === "dark" ? storedTheme : "dark";
  applyTheme(initialTheme);

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const current =
        root.getAttribute("data-theme") === "light" ? "dark" : "light";
      localStorage.setItem(THEME_KEY, current);
      applyTheme(current);
    });
  }

  // Contact form demo handler
  const form = document.getElementById("contact-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      alert(
        "Thank you for reaching out to Project AARNA. This is a front-end demo — connect this form to your backend or email service."
      );
      form.reset();
    });
  }
});
