// js/admin.js
(function () {
  "use strict";

  const ADMIN_EMAIL_ALLOWED = "projectaarna@protonmail.com";

  function $(id) { return document.getElementById(id); }

  function msg(el, text, ok = false) {
    if (!el) return;
    el.textContent = text || "";
    el.style.color = ok ? "rgba(160,255,200,0.95)" : "rgba(255,180,180,0.95)";
  }

  // theme
  const themeBtn = $("theme-toggle");
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

  function getSb() {
    return window.sb || null;
  }

  const authBox = $("admin-auth");
  const appBox = $("admin-app");
  const loginForm = $("admin-login-form");
  const authMsg = $("admin-auth-msg");

  const logoutBtn = $("admin-logout");

  const tabs = Array.from(document.querySelectorAll(".admin-tab"));
  const panels = {
    stats: $("tab-stats"),
    experiments: $("tab-experiments"),
    messages: $("tab-messages"),
    newsletter: $("tab-newsletter"),
  };

  function showTab(name) {
    tabs.forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    Object.entries(panels).forEach(([k, el]) => {
      if (el) el.style.display = k === name ? "" : "none";
    });

    // lazy-load per tab
    if (name === "experiments") loadExperiments();
    if (name === "messages") loadMessages(currentMsgFilter);
    if (name === "newsletter") loadNewsletter();
    if (name === "stats") loadVisitorCount();
  }

  tabs.forEach((b) => {
    b.addEventListener("click", () => showTab(b.dataset.tab));
  });

  async function enforceAllowedAdmin(sb) {
    const { data } = await sb.auth.getUser();
    const email = data?.user?.email?.toLowerCase() || "";
    if (email !== ADMIN_EMAIL_ALLOWED) {
      await sb.auth.signOut();
      throw new Error("Not authorized for this admin.");
    }
  }

  async function bootIfSession() {
    const sb = getSb();
    if (!sb) {
      msg(authMsg, "Supabase client not ready. Check supabaseClient.js.", false);
      return;
    }

    const { data } = await sb.auth.getSession();
    if (data?.session) {
      try {
        await enforceAllowedAdmin(sb);
        authBox.style.display = "none";
        appBox.style.display = "";
        showTab("stats");
      } catch (e) {
        msg(authMsg, e.message || "Auth failed", false);
      }
    }
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      msg(authMsg, "");

      const sb = getSb();
      if (!sb) {
        msg(authMsg, "Supabase client not ready.", false);
        return;
      }

      const email = $("admin-email").value.trim().toLowerCase();
      const password = $("admin-password").value;

      try {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;

        await enforceAllowedAdmin(sb);

        authBox.style.display = "none";
        appBox.style.display = "";
        showTab("stats");
      } catch (err) {
        msg(authMsg, err?.message || "Login failed", false);
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      const sb = getSb();
      if (sb) await sb.auth.signOut();
      location.reload();
    });
  }

  // ---------- STATS (ONLY ONE NUMBER) ----------
  async function loadVisitorCount() {
    const el = $("unique-visitors");
    if (!el) return;
    el.textContent = "—";

    try {
      const r = await fetch("/api/visitor-stats", { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed");
      el.textContent = String(j.uniqueVisitors ?? 0);
    } catch (e) {
      el.textContent = "—";
      console.warn("[AARNA] visitor-stats failed:", e);
    }
  }

  // ---------- EXPERIMENTS CRUD ----------
  const expList = $("exp-list");
  const expNew = $("exp-new");
  const expModal = $("exp-modal");
  const expClose = $("exp-close");
  const expForm = $("exp-form");
  const expMsg = $("exp-msg");
  const expDelete = $("exp-delete");

  let expCache = [];

  function openExpModal(mode, row) {
    msg(expMsg, "");
    $("exp-modal-title").textContent = mode === "edit" ? "Edit experiment" : "New experiment";

    $("exp-id").value = row?.id || "";
    $("exp-title").value = row?.title || "";
    $("exp-status").value = row?.status_label || "";
    $("exp-description").value = row?.description || "";
    $("exp-sort").value = (row?.sort_order ?? 0);
    $("exp-published").checked = row?.is_published !== false;

    expDelete.style.display = mode === "edit" ? "" : "none";
    expModal.style.display = "";
  }

  function closeExpModal() {
    expModal.style.display = "none";
  }

  if (expNew) expNew.addEventListener("click", () => openExpModal("new", null));
  if (expClose) expClose.addEventListener("click", closeExpModal);
  if (expModal) expModal.addEventListener("click", (e) => {
    if (e.target === expModal) closeExpModal();
  });

  async function loadExperiments() {
    const sb = getSb();
    if (!sb || !expList) return;

    expList.innerHTML = `<div class="admin-item"><div class="meta">Loading…</div></div>`;

    const { data, error } = await sb
      .from("experiments")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      expList.innerHTML = `<div class="admin-item"><div class="meta">Failed to load experiments.</div></div>`;
      console.error(error);
      return;
    }

    expCache = data || [];
    renderExperiments();
  }

  function renderExperiments() {
    if (!expList) return;
    if (!expCache.length) {
      expList.innerHTML = `<div class="admin-item"><div class="meta">No experiments yet.</div></div>`;
      return;
    }

    expList.innerHTML = "";
    expCache.forEach((x) => {
      const item = document.createElement("div");
      item.className = "admin-item";

      const h = document.createElement("h4");
      h.textContent = x.title || "Untitled";

      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = `${x.is_published ? "Published" : "Hidden"} · ${x.status_label || "—"} · sort: ${x.sort_order ?? 0}`;

      const p = document.createElement("p");
      p.textContent = x.description || "";

      const actions = document.createElement("div");
      actions.className = "actions";

      const edit = document.createElement("button");
      edit.className = "btn btn-secondary";
      edit.type = "button";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => openExpModal("edit", x));

      const toggle = document.createElement("button");
      toggle.className = "btn btn-secondary";
      toggle.type = "button";
      toggle.textContent = x.is_published ? "Unpublish" : "Publish";
      toggle.addEventListener("click", async () => {
        const sb = getSb();
        if (!sb) return;

        const next = !x.is_published;
        const { error } = await sb
          .from("experiments")
          .update({ is_published: next })
          .eq("id", x.id);

        if (error) return console.error(error);
        x.is_published = next;
        renderExperiments();
      });

      actions.appendChild(edit);
      actions.appendChild(toggle);

      item.appendChild(h);
      item.appendChild(meta);
      item.appendChild(p);
      item.appendChild(actions);
      expList.appendChild(item);
    });
  }

  if (expForm) {
    expForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      msg(expMsg, "");

      const sb = getSb();
      if (!sb) return msg(expMsg, "Supabase not ready.", false);

      const id = $("exp-id").value.trim();
      const payload = {
        title: $("exp-title").value.trim(),
        status_label: $("exp-status").value.trim(),
        description: $("exp-description").value.trim(),
        sort_order: Number($("exp-sort").value || 0),
        is_published: $("exp-published").checked,
      };

      if (!payload.title || !payload.description) {
        return msg(expMsg, "Title and description are required.", false);
      }

      try {
        if (id) {
          const { error } = await sb.from("experiments").update(payload).eq("id", id);
          if (error) throw error;
          msg(expMsg, "Saved.", true);
        } else {
          const { error } = await sb.from("experiments").insert([payload]);
          if (error) throw error;
          msg(expMsg, "Created.", true);
        }

        await loadExperiments();
        setTimeout(closeExpModal, 300);
      } catch (err) {
        console.error(err);
        msg(expMsg, err?.message || "Save failed.", false);
      }
    });
  }

  if (expDelete) {
    expDelete.addEventListener("click", async () => {
      msg(expMsg, "");
      const sb = getSb();
      if (!sb) return;

      const id = $("exp-id").value.trim();
      if (!id) return;

      if (!confirm("Delete this experiment?")) return;

      const { error } = await sb.from("experiments").delete().eq("id", id);
      if (error) return msg(expMsg, error.message || "Delete failed.", false);

      msg(expMsg, "Deleted.", true);
      await loadExperiments();
      setTimeout(closeExpModal, 300);
    });
  }

  // ---------- MESSAGES ----------
  const msgList = $("msg-list");
  const segBtns = Array.from(document.querySelectorAll(".admin-seg-btn"));
  let currentMsgFilter = "open";

  segBtns.forEach((b) => {
    b.addEventListener("click", () => {
      segBtns.forEach((x) => x.classList.toggle("active", x === b));
      currentMsgFilter = b.dataset.filter;
      loadMessages(currentMsgFilter);
    });
  });

  async function loadMessages(filter) {
    const sb = getSb();
    if (!sb || !msgList) return;

    msgList.innerHTML = `<div class="admin-item"><div class="meta">Loading…</div></div>`;

    const q = sb
      .from("contact_messages")
      .select("*")
      .eq("status", filter)
      .order("created_at", { ascending: false });

    const { data, error } = await q;
    if (error) {
      console.error(error);
      msgList.innerHTML = `<div class="admin-item"><div class="meta">Failed to load messages.</div></div>`;
      return;
    }

    const rows = data || [];
    if (!rows.length) {
      msgList.innerHTML = `<div class="admin-item"><div class="meta">No ${filter} messages.</div></div>`;
      return;
    }

    msgList.innerHTML = "";
    rows.forEach((m) => {
      const item = document.createElement("div");
      item.className = "admin-item";

      const h = document.createElement("h4");
      h.textContent = `${m.name || "—"} · ${m.email || "—"}`;

      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = new Date(m.created_at).toLocaleString();

      const p = document.createElement("p");
      p.textContent = m.message || "";

      const actions = document.createElement("div");
      actions.className = "actions";

      if (filter === "open") {
        const close = document.createElement("button");
        close.className = "btn btn-secondary";
        close.type = "button";
        close.textContent = "Mark closed";
        close.addEventListener("click", async () => {
          const { error } = await sb
            .from("contact_messages")
            .update({ status: "closed", closed_at: new Date().toISOString() })
            .eq("id", m.id);

          if (error) return console.error(error);
          loadMessages("open");
        });
        actions.appendChild(close);
      } else {
        const reopen = document.createElement("button");
        reopen.className = "btn btn-secondary";
        reopen.type = "button";
        reopen.textContent = "Reopen";
        reopen.addEventListener("click", async () => {
          const { error } = await sb
            .from("contact_messages")
            .update({ status: "open", closed_at: null })
            .eq("id", m.id);

          if (error) return console.error(error);
          loadMessages("closed");
        });
        actions.appendChild(reopen);
      }

      item.appendChild(h);
      item.appendChild(meta);
      item.appendChild(p);
      item.appendChild(actions);

      msgList.appendChild(item);
    });
  }

  // ---------- NEWSLETTER ----------
  const newsList = $("news-list");

  async function loadNewsletter() {
    const sb = getSb();
    if (!sb || !newsList) return;

    newsList.innerHTML = `<div class="admin-item"><div class="meta">Loading…</div></div>`;

    const { data, error } = await sb
      .from("newsletter_subscribers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      newsList.innerHTML = `<div class="admin-item"><div class="meta">Failed to load newsletter list.</div></div>`;
      return;
    }

    const rows = data || [];
    if (!rows.length) {
      newsList.innerHTML = `<div class="admin-item"><div class="meta">No subscribers yet.</div></div>`;
      return;
    }

    newsList.innerHTML = "";
    rows.forEach((n) => {
      const item = document.createElement("div");
      item.className = "admin-item";

      const h = document.createElement("h4");
      h.textContent = n.email || "—";

      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = `${n.name || "—"} · ${new Date(n.created_at).toLocaleString()}`;

      item.appendChild(h);
      item.appendChild(meta);
      newsList.appendChild(item);
    });
  }

  // boot
  bootIfSession();
})();
