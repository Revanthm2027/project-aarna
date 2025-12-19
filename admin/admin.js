/* admin/admin.js
   Project AARNA Admin Console (no framework)
   - Login (Supabase Auth) restricted to one email
   - Tabs: Overview, Messages, Experiments, Newsletter
   - Experiments: Add/Edit/Delete + Publish toggle
   - Visitor count: single number from /api/visitor-stats
*/

(function () {
  const ADMIN_EMAIL = "projectaarna@protonmail.com";

  const root = document.getElementById("admin-root");
  if (!root) {
    console.error("[ADMIN] #admin-root not found");
    return;
  }

  // ---------- tiny utils ----------
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(ts) {
    if (!ts) return "—";
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return String(ts);
    }
  }

  function toast(msg, type = "info") {
    let box = document.getElementById("aarna-toast");
    if (!box) {
      box = document.createElement("div");
      box.id = "aarna-toast";
      box.className = "toast toast--hidden";
      document.body.appendChild(box);
    }
    box.className = `toast toast--${type}`;
    box.textContent = msg;
    setTimeout(() => (box.className = "toast toast--hidden"), 2600);
  }

  function setLoading(isLoading) {
    root.setAttribute("data-loading", isLoading ? "true" : "false");
  }

  // ---------- Supabase guard ----------
  if (!window.sb) {
    root.innerHTML = `
      <div class="admin-card">
        <h3 style="text-align:center;margin:0 0 .5rem;">Backend not configured</h3>
        <p style="text-align:center;margin:0;color:var(--text-muted);">
          Supabase client not found (window.sb). Check /js/supabaseClient.js loading.
        </p>
      </div>`;
    return;
  }

  const sb = window.sb;

  const state = {
    user: null,
    tab: "overview",
    msgFilter: "open", // open | closed | all
    editingExperimentId: null,
  };

  // ---------- render shell ----------
  function render() {
    root.innerHTML = "";

    if (!state.user) {
      renderLogin();
      return;
    }

    const shell = document.createElement("div");
    shell.className = "admin-shell";

    shell.innerHTML = `
      <div class="admin-top">
        <div class="admin-title">
          <h3>Admin Console</h3>
          <p>Manage messages, experiments, newsletter, and visitor count.</p>
        </div>

        <div class="admin-actions">
          <button class="btn btn-secondary" id="admin-refresh" type="button">Refresh</button>
          <button class="btn btn-secondary" id="admin-logout" type="button">Logout</button>
        </div>
      </div>

      <div class="admin-tabs" role="tablist" aria-label="Admin sections">
        <button class="tab-btn" data-tab="overview" type="button">Overview</button>
        <button class="tab-btn" data-tab="messages" type="button">Messages</button>
        <button class="tab-btn" data-tab="experiments" type="button">Experiments</button>
        <button class="tab-btn" data-tab="newsletter" type="button">Newsletter</button>
      </div>

      <div class="admin-panel" id="admin-panel"></div>
    `;

    root.appendChild(shell);

    // tab active state
    $$(".tab-btn", root).forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === state.tab);
      b.addEventListener("click", () => {
        state.tab = b.dataset.tab;
        render(); // re-render whole panel to keep it simple & reliable
      });
    });

    $("#admin-refresh", root).addEventListener("click", () => render());
    $("#admin-logout", root).addEventListener("click", doLogout);

    // render active tab
    const panel = $("#admin-panel", root);
    if (state.tab === "overview") renderOverview(panel);
    if (state.tab === "messages") renderMessages(panel);
    if (state.tab === "experiments") renderExperiments(panel);
    if (state.tab === "newsletter") renderNewsletter(panel);
  }

  // ---------- login ----------
  function renderLogin() {
    const card = document.createElement("div");
    card.className = "admin-card";
    card.innerHTML = `
      <h3 style="text-align:center;margin:0 0 .25rem;">Admin</h3>
      <p style="text-align:center;margin:0 0 1.25rem;color:var(--text-muted);">
        Sign in to access the console.
      </p>

      <form id="admin-login-form" class="admin-form">
        <label>
          Email
          <input id="admin-email" type="email" autocomplete="username" required placeholder="${ADMIN_EMAIL}">
        </label>
        <label>
          Password
          <input id="admin-pass" type="password" autocomplete="current-password" required placeholder="••••••••">
        </label>
        <button class="btn btn-primary" type="submit" id="admin-login-btn">Login</button>
      </form>

      <p class="admin-hint">
        Only <strong>${ADMIN_EMAIL}</strong> is allowed.
      </p>
    `;

    root.appendChild(card);

    const form = $("#admin-login-form", root);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setLoading(true);

      const email = $("#admin-email", root).value.trim();
      const password = $("#admin-pass", root).value;

      try {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const u = data?.user;
        if (!u || u.email !== ADMIN_EMAIL) {
          await sb.auth.signOut();
          toast("Not authorized for this admin console.", "error");
          setLoading(false);
          return;
        }

        state.user = u;
        toast("Logged in.", "success");
        setLoading(false);
        render();
      } catch (err) {
        console.error("[ADMIN] login error", err);
        toast(err?.message || "Login failed.", "error");
        setLoading(false);
      }
    });
  }

  async function doLogout() {
    try {
      await sb.auth.signOut();
    } catch {}
    state.user = null;
    toast("Logged out.", "info");
    render();
  }

  // ---------- data helpers ----------
  async function safeSelect(table, queryFn) {
    try {
      const q = sb.from(table);
      const res = await queryFn(q);
      if (res.error) throw res.error;
      return res.data || [];
    } catch (e) {
      console.warn(`[ADMIN] select failed for ${table}:`, e?.message || e);
      return null;
    }
  }

  async function safeCount(table, filterFn) {
    try {
      let q = sb.from(table).select("id", { count: "exact", head: true });
      if (filterFn) q = filterFn(q);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    } catch (e) {
      console.warn(`[ADMIN] count failed for ${table}:`, e?.message || e);
      return null;
    }
  }

  // ---------- Overview ----------
  async function renderOverview(panel) {
    panel.innerHTML = `
      <div class="admin-grid">
        <div class="stat-card">
          <h4>Unique visitors</h4>
          <div class="stat-value" id="stat-visitors">—</div>
          <p class="stat-sub">Counts unique IP hashes (lifetime).</p>
        </div>

        <div class="stat-card">
          <h4>Open messages</h4>
          <div class="stat-value" id="stat-open">—</div>
          <p class="stat-sub">Contact form submissions not closed.</p>
        </div>

        <div class="stat-card">
          <h4>Closed messages</h4>
          <div class="stat-value" id="stat-closed">—</div>
          <p class="stat-sub">Messages you marked as closed.</p>
        </div>

        <div class="stat-card">
          <h4>Published experiments</h4>
          <div class="stat-value" id="stat-exp">—</div>
          <p class="stat-sub">Visible on the live site.</p>
        </div>

        <div class="stat-card">
          <h4>Newsletter list</h4>
          <div class="stat-value" id="stat-news">—</div>
          <p class="stat-sub">Emails opted in for updates.</p>
        </div>
      </div>
    `;

    setLoading(true);

    // visitor stats from API
    try {
      const r = await fetch("/api/visitor-stats", { cache: "no-store" });
      const j = await r.json();
      $("#stat-visitors", panel).textContent =
        typeof j?.unique_visitors === "number" ? String(j.unique_visitors) : "—";
    } catch (e) {
      $("#stat-visitors", panel).textContent = "—";
    }

    // counts from DB
    const openCount =
      (await safeCount("contact_messages", (q) => q.eq("status", "open"))) ??
      (await safeCount("contact_messages", null)) ??
      "—";

    const closedCount =
      (await safeCount("contact_messages", (q) => q.eq("status", "closed"))) ?? "—";

    const expCount =
      (await safeCount("experiments", (q) => q.eq("is_published", true))) ?? "—";

    // newsletter can be its own table OR derived from contact_messages opt-in
    const newsCount =
      (await safeCount("newsletter_signups", null)) ??
      (await safeCount("contact_messages", (q) => q.eq("newsletter_optin", true))) ??
      "—";

    $("#stat-open", panel).textContent = String(openCount);
    $("#stat-closed", panel).textContent = String(closedCount);
    $("#stat-exp", panel).textContent = String(expCount);
    $("#stat-news", panel).textContent = String(newsCount);

    setLoading(false);
  }

  // ---------- Messages ----------
  async function renderMessages(panel) {
    panel.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-head">
          <h3>Messages</h3>
          <div class="row">
            <label class="small-label">Filter</label>
            <select id="msg-filter">
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>

        <div id="msg-list" class="admin-list">Loading…</div>
      </div>
    `;

    $("#msg-filter", panel).value = state.msgFilter;
    $("#msg-filter", panel).addEventListener("change", () => {
      state.msgFilter = $("#msg-filter", panel).value;
      render(); // re-render
    });

    setLoading(true);

    let rows = await safeSelect("contact_messages", (q) => {
      let qq = q.select("*").order("created_at", { ascending: false }).limit(200);
      if (state.msgFilter === "open") qq = qq.eq("status", "open");
      if (state.msgFilter === "closed") qq = qq.eq("status", "closed");
      return qq;
    });

    if (rows === null) {
      $("#msg-list", panel).innerHTML = `
        <div class="empty">
          Could not load <code>contact_messages</code>. Check table name / RLS policies.
        </div>`;
      setLoading(false);
      return;
    }

    if (!rows.length) {
      $("#msg-list", panel).innerHTML = `<div class="empty">No messages.</div>`;
      setLoading(false);
      return;
    }

    $("#msg-list", panel).innerHTML = rows
      .map((m) => {
        const status = m.status || "open";
        return `
          <div class="list-item">
            <div class="list-main">
              <div class="list-title">
                ${escapeHtml(m.name || "—")}
                <span class="pill pill-${status === "closed" ? "muted" : "blue"}">${escapeHtml(status)}</span>
              </div>
              <div class="list-meta">
                <span>${escapeHtml(m.email || "—")}</span>
                <span>•</span>
                <span>${escapeHtml(formatDate(m.created_at))}</span>
              </div>
              <div class="list-body">${escapeHtml(m.message || "")}</div>
              ${
                m.newsletter_optin
                  ? `<div class="list-foot">✅ opted into newsletter</div>`
                  : `<div class="list-foot">—</div>`
              }
            </div>
            <div class="list-actions">
              ${
                status === "closed"
                  ? `<button class="btn btn-secondary" data-action="reopen" data-id="${escapeHtml(m.id)}" type="button">Reopen</button>`
                  : `<button class="btn btn-secondary" data-action="close" data-id="${escapeHtml(m.id)}" type="button">Close</button>`
              }
              <button class="btn btn-secondary" data-action="delete" data-id="${escapeHtml(m.id)}" type="button">Delete</button>
            </div>
          </div>
        `;
      })
      .join("");

    // actions
    $("#msg-list", panel).addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");

      if (!id) return;

      try {
        setLoading(true);

        if (action === "close") {
          const { error } = await sb.from("contact_messages").update({ status: "closed" }).eq("id", id);
          if (error) throw error;
          toast("Marked as closed.", "success");
        }

        if (action === "reopen") {
          const { error } = await sb.from("contact_messages").update({ status: "open" }).eq("id", id);
          if (error) throw error;
          toast("Reopened.", "success");
        }

        if (action === "delete") {
          if (!confirm("Delete this message?")) {
            setLoading(false);
            return;
          }
          const { error } = await sb.from("contact_messages").delete().eq("id", id);
          if (error) throw error;
          toast("Deleted.", "success");
        }

        setLoading(false);
        render(); // refresh list
      } catch (err) {
        console.error("[ADMIN] message action error", err);
        toast(err?.message || "Action failed.", "error");
        setLoading(false);
      }
    });

    setLoading(false);
  }

  // ---------- Experiments ----------
  async function renderExperiments(panel) {
    panel.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-head">
          <h3>Experiments</h3>
          <div class="row">
            <button class="btn btn-primary" id="exp-new" type="button">+ New</button>
          </div>
        </div>

        <div id="exp-form-wrap" class="exp-form-wrap" style="display:none;"></div>
        <div id="exp-list" class="admin-list">Loading…</div>
      </div>
    `;

    $("#exp-new", panel).addEventListener("click", () => {
      state.editingExperimentId = null;
      showExperimentForm(panel, null);
    });

    setLoading(true);

    const rows = await safeSelect("experiments", (q) =>
      q.select("*").order("created_at", { ascending: false }).limit(200)
    );

    if (rows === null) {
      $("#exp-list", panel).innerHTML = `
        <div class="empty">
          Could not load <code>experiments</code>. Check table name / RLS policies.
        </div>`;
      setLoading(false);
      return;
    }

    $("#exp-list", panel).innerHTML = rows.length
      ? rows
          .map((x) => {
            const pub = !!x.is_published;
            return `
              <div class="list-item">
                <div class="list-main">
                  <div class="list-title">
                    ${escapeHtml(x.title || "Untitled")}
                    <span class="pill ${pub ? "pill-green" : "pill-muted"}">${pub ? "published" : "draft"}</span>
                  </div>
                  <div class="list-meta">
                    <span>${escapeHtml(x.status || "—")}</span>
                    <span>•</span>
                    <span>${escapeHtml(formatDate(x.created_at))}</span>
                  </div>
                  <div class="list-body">${escapeHtml(x.description || "")}</div>
                </div>
                <div class="list-actions">
                  <button class="btn btn-secondary" data-action="edit" data-id="${escapeHtml(x.id)}" type="button">Edit</button>
                  <button class="btn btn-secondary" data-action="toggle" data-id="${escapeHtml(x.id)}" data-pub="${pub ? "1" : "0"}" type="button">
                    ${pub ? "Unpublish" : "Publish"}
                  </button>
                  <button class="btn btn-secondary" data-action="delete" data-id="${escapeHtml(x.id)}" type="button">Delete</button>
                </div>
              </div>
            `;
          })
          .join("")
      : `<div class="empty">No experiments yet. Click <strong>+ New</strong>.</div>`;

    $("#exp-list", panel).addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");
      if (!id) return;

      try {
        if (action === "edit") {
          const row = rows.find((r) => String(r.id) === String(id));
          state.editingExperimentId = id;
          showExperimentForm(panel, row);
          return;
        }

        setLoading(true);

        if (action === "toggle") {
          const currently = btn.getAttribute("data-pub") === "1";
          const { error } = await sb.from("experiments").update({ is_published: !currently }).eq("id", id);
          if (error) throw error;
          toast(!currently ? "Published." : "Unpublished.", "success");
        }

        if (action === "delete") {
          if (!confirm("Delete this experiment?")) {
            setLoading(false);
            return;
          }
          const { error } = await sb.from("experiments").delete().eq("id", id);
          if (error) throw error;
          toast("Deleted.", "success");
        }

        setLoading(false);
        render();
      } catch (err) {
        console.error("[ADMIN] experiment action error", err);
        toast(err?.message || "Action failed.", "error");
        setLoading(false);
      }
    });

    setLoading(false);
  }

  function showExperimentForm(panel, row) {
    const wrap = $("#exp-form-wrap", panel);
    wrap.style.display = "block";

    const isEdit = !!row;
    wrap.innerHTML = `
      <div class="admin-subcard">
        <div class="admin-subhead">
          <h4 style="margin:0;text-align:center;">${isEdit ? "Edit experiment" : "New experiment"}</h4>
        </div>

        <form id="exp-form" class="admin-form">
          <label>
            Status tag (e.g. Upcoming / Planned)
            <input id="exp-status" type="text" placeholder="Upcoming" value="${escapeHtml(row?.status || "")}">
          </label>

          <label>
            Title
            <input id="exp-title" type="text" required placeholder="Pilot · XYZ mangrove reserve" value="${escapeHtml(row?.title || "")}">
          </label>

          <label>
            Description
            <textarea id="exp-desc" rows="4" required placeholder="Short description…">${escapeHtml(row?.description || "")}</textarea>
          </label>

          <label class="row-check">
            <input id="exp-pub" type="checkbox" ${row?.is_published ? "checked" : ""}>
            Publish on live site
          </label>

          <div class="row-actions">
            <button class="btn btn-primary" type="submit">${isEdit ? "Save changes" : "Create"}</button>
            <button class="btn btn-secondary" type="button" id="exp-cancel">Cancel</button>
          </div>
        </form>
      </div>
    `;

    $("#exp-cancel", wrap).addEventListener("click", () => {
      wrap.style.display = "none";
      wrap.innerHTML = "";
      state.editingExperimentId = null;
    });

    $("#exp-form", wrap).addEventListener("submit", async (e) => {
      e.preventDefault();

      const payload = {
        status: $("#exp-status", wrap).value.trim(),
        title: $("#exp-title", wrap).value.trim(),
        description: $("#exp-desc", wrap).value.trim(),
        is_published: $("#exp-pub", wrap).checked,
      };

      try {
        setLoading(true);

        if (isEdit) {
          const { error } = await sb.from("experiments").update(payload).eq("id", row.id);
          if (error) throw error;
          toast("Updated.", "success");
        } else {
          const { error } = await sb.from("experiments").insert(payload);
          if (error) throw error;
          toast("Created.", "success");
        }

        setLoading(false);
        render();
      } catch (err) {
        console.error("[ADMIN] save experiment error", err);
        toast(err?.message || "Save failed.", "error");
        setLoading(false);
      }
    });
  }

  // ---------- Newsletter ----------
  async function renderNewsletter(panel) {
    panel.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-head">
          <h3>Newsletter</h3>
          <div class="row">
            <button class="btn btn-secondary" id="news-copy" type="button">Copy emails</button>
          </div>
        </div>

        <div id="news-list" class="admin-list">Loading…</div>
      </div>
    `;

    setLoading(true);

    // Prefer dedicated table; fallback to contact_messages optin
    let emails = await safeSelect("newsletter_signups", (q) =>
      q.select("*").order("created_at", { ascending: false }).limit(500)
    );

    if (emails === null) {
      const optins = await safeSelect("contact_messages", (q) =>
        q.select("email,created_at").eq("newsletter_optin", true).order("created_at", { ascending: false }).limit(500)
      );
      emails = (optins || []).map((x) => ({ email: x.email, created_at: x.created_at }));
    }

    if (!emails || !emails.length) {
      $("#news-list", panel).innerHTML = `<div class="empty">No newsletter emails yet.</div>`;
      setLoading(false);
      return;
    }

    $("#news-list", panel).innerHTML = emails
      .map(
        (n) => `
        <div class="list-item">
          <div class="list-main">
            <div class="list-title">${escapeHtml(n.email || "—")}</div>
            <div class="list-meta">${escapeHtml(formatDate(n.created_at))}</div>
          </div>
        </div>`
      )
      .join("");

    $("#news-copy", panel).addEventListener("click", async () => {
      const list = emails.map((x) => x.email).filter(Boolean).join(", ");
      try {
        await navigator.clipboard.writeText(list);
        toast("Copied.", "success");
      } catch {
        toast("Copy failed.", "error");
      }
    });

    setLoading(false);
  }

  // ---------- init ----------
  async function init() {
    try {
      const { data } = await sb.auth.getSession();
      const session = data?.session;

      if (session?.user?.email === ADMIN_EMAIL) {
        state.user = session.user;
      } else if (session) {
        await sb.auth.signOut();
        state.user = null;
      }
    } catch (e) {
      state.user = null;
    }

    render();
  }

  init();
})();
