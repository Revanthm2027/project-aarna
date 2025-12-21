/* /admin/admin.js */
(function () {
  const ADMIN_EMAIL = "projectaarna@protonmail.com";
  const BUCKET = "experiments";

  const root = document.getElementById("admin-root");
  if (!root) return;

  const esc = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  function showToast(msg, type = "info") {
    const t = document.createElement("div");
    t.className = `toast show ${type === "success" ? "toast-success" : ""} ${type === "error" ? "toast-error" : ""}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.remove("show"), 2600);
    setTimeout(() => t.remove(), 3200);
  }

  function setLoading(title = "Loading…") {
    root.innerHTML = `
      <div style="text-align:center;">
        <h3 style="margin:0 0 6px;">${esc(title)}</h3>
        <p style="opacity:.75;margin:0;">Please wait.</p>
      </div>
    `;
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

  async function resolveTable(sb, candidates) {
    for (const name of candidates) {
      const { error } = await sb.from(name).select("*").limit(1);
      if (!error) return name;
    }
    return null;
  }

  function renderLogin(prefill = ADMIN_EMAIL) {
    root.innerHTML = `
      <div style="max-width:760px;margin:0 auto;">
        <h3 style="text-align:center;margin:0 0 8px;">Sign in</h3>
        <p style="text-align:center;opacity:.75;margin:0 0 18px;">
          Use your Supabase Auth credentials.
        </p>

        <form id="admin-login-form" class="contact-form" style="gap:12px;">
          <label>Email
            <input name="email" type="email" required value="${esc(prefill)}" />
          </label>
          <label>Password
            <input name="password" type="password" required placeholder="Your password" />
          </label>
          <button id="admin-login-btn" class="btn btn-primary" type="submit">Login</button>
          <p class="form-info">
            Supabase → Authentication → Users → ensure this user is confirmed.
          </p>
        </form>
      </div>
    `;

    document.getElementById("admin-login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const sb = window.sb;
      if (!sb) return showToast("Backend not ready (Supabase).", "error");

      const btn = document.getElementById("admin-login-btn");
      btn.disabled = true;
      btn.textContent = "Signing in…";

      const email = e.target.elements.email.value.trim();
      const password = e.target.elements.password.value;

      try {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) return showToast(error.message || "Login failed", "error");

        const userEmail = (data?.user?.email || "").toLowerCase();
        if (userEmail !== ADMIN_EMAIL.toLowerCase()) {
          await sb.auth.signOut();
          return showToast("Not allowed. Only the AARNA admin account can access.", "error");
        }

        showToast("Signed in.", "success");
        await renderApp();
      } catch (err) {
        showToast(err?.message || "Login crashed", "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Login";
      }
    });
  }

  function appShell() {
    return `
      <div class="admin-tabs">
        <button class="admin-tab active" data-tab="experiments">Experiments</button>
        <button class="admin-tab" data-tab="stats">Stats</button>
        <button class="admin-tab" data-tab="messages">Messages</button>
        <button class="admin-tab" data-tab="newsletter">Newsletter</button>
        <button class="admin-tab" data-tab="signout">Sign out</button>
      </div>
      <div id="admin-content" class="admin-panel"></div>
    `;
  }

  async function renderStats() {
    const el = document.getElementById("admin-content");
    el.innerHTML = `
      <div style="text-align:center;">
        <h3 style="margin:0 0 10px;">Visitors</h3>
        <div class="pill-card hover-float" style="max-width:520px;margin:0 auto;">
          <span class="pill-label">Unique visitors</span>
          <div id="uv" style="font-size:44px;font-weight:800;margin-top:8px;">—</div>
          <p style="color:var(--text-muted);margin:10px 0 0;">Counts each unique IP once.</p>
        </div>
      </div>
    `;
    try {
      const r = await fetch("/api/visitor-stats", { cache: "no-store" });
      const j = await r.json();
      document.getElementById("uv").textContent = String(j.unique_visitors ?? 0);
    } catch {
      document.getElementById("uv").textContent = "—";
      showToast("Visitor stats API not available.", "error");
    }
  }

  async function renderExperiments(sb) {
    const el = document.getElementById("admin-content");
    el.innerHTML = `
      <div class="admin-split">
        <div class="contact-form-card hover-float">
          <h3 style="margin:0 0 12px;">Create experiment</h3>

          <form id="new-exp-form" class="contact-form" style="gap:12px;">
            <label>Title
              <input name="title" required />
            </label>

            <label>Status
              <input name="status" placeholder="Planned / Ongoing / Completed" />
            </label>

            <label>Description
              <textarea name="description" rows="4" required></textarea>
            </label>

            <label style="display:flex;gap:10px;align-items:center;">
              <input type="checkbox" name="is_published" />
              Publish on live site
            </label>

            <label>Images (max 4)
              <input name="images" type="file" accept="image/*" multiple />
            </label>

            <button id="new-exp-submit" class="btn btn-primary" type="submit">Create</button>
            <p class="form-info">Note: Summary is auto-generated from description to satisfy DB constraint.</p>
          </form>
        </div>

        <div>
          <h3 style="margin:0 0 12px;">Existing</h3>
          <div id="exp-list" class="experiments-grid"></div>
        </div>
      </div>
    `;

    const expTable = await resolveTable(sb, ["experiments"]);
    if (!expTable) return showToast("Table 'experiments' not found.", "error");

    async function loadList() {
      const list = document.getElementById("exp-list");
      list.innerHTML = `<p style="color:var(--text-muted);">Loading…</p>`;

      const { data, error } = await sb
        .from(expTable)
        .select("id,title,status,summary,description,is_published,image_paths,created_at")
        .order("created_at", { ascending: false });

      if (error) {
        list.innerHTML = "";
        return showToast(error.message || "Failed to load experiments", "error");
      }

      if (!data?.length) {
        list.innerHTML = `<p style="color:var(--text-muted);">No experiments yet.</p>`;
        return;
      }

      list.innerHTML = data.map((x) => `
        <article class="experiment-card hover-float">
          <span class="experiment-status">${esc(x.status || (x.is_published ? "Published" : "Hidden"))}</span>
          <h3>${esc(x.title || "")}</h3>
          <p>${esc((x.summary || x.description || "").slice(0, 220))}</p>

          <div class="admin-actions">
            <button class="btn btn-secondary" data-act="toggle" data-id="${x.id}">
              ${x.is_published ? "Unpublish" : "Publish"}
            </button>
            <button class="btn btn-secondary" data-act="delete" data-id="${x.id}">Delete</button>
          </div>
        </article>
      `).join("");

      list.querySelectorAll("button[data-act]").forEach((b) => {
        b.addEventListener("click", async () => {
          const id = b.getAttribute("data-id");
          const act = b.getAttribute("data-act");

          if (act === "delete") {
            if (!confirm("Delete this experiment?")) return;
            const { error } = await sb.from(expTable).delete().eq("id", id);
            if (error) return showToast(error.message || "Delete failed", "error");
            showToast("Deleted.", "success");
            return loadList();
          }

          if (act === "toggle") {
            const row = data.find((r) => String(r.id) === String(id));
            const next = !row?.is_published;
            const { error } = await sb.from(expTable).update({ is_published: next }).eq("id", id);
            if (error) return showToast(error.message || "Update failed", "error");
            showToast(next ? "Published." : "Unpublished.", "success");
            return loadList();
          }
        });
      });
    }

    document.getElementById("new-exp-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("new-exp-submit");
      btn.disabled = true;
      btn.textContent = "Saving…";

      try {
        const f = e.target;
        const title = f.elements.title.value.trim();
        const status = f.elements.status.value.trim();
        const description = f.elements.description.value.trim();
        const is_published = !!f.elements.is_published.checked;

        // IMPORTANT: summary is required in your DB
        const summary = description.length > 140 ? (description.slice(0, 137) + "...") : description;

        const allFiles = Array.from(f.elements.images.files || []);
        const files = allFiles.slice(0, 4);
        if (allFiles.length > 4) showToast("Only 4 images allowed. Extra ignored.", "error");

        const image_paths = [];
        for (const file of files) {
          const safe = (file.name || "image").replace(/[^\w.\-]+/g, "_");
          const uuid = (crypto.randomUUID?.() || String(Date.now()));
          const path = `exp/${uuid}_${safe}`;

          const { error: upErr } = await sb.storage.from(BUCKET).upload(path, file, {
            upsert: false,
            contentType: file.type
          });
          if (upErr) throw new Error(upErr.message || "Upload failed");

          image_paths.push(path);
        }

        const payload = {
          title,
          status: status || null,
          summary,                 // FIX for your NOT NULL constraint
          description,             // keep if your table has it
          is_published,
          image_paths: image_paths.length ? image_paths : null
        };

        const { error } = await sb.from(expTable).insert([payload]);
        if (error) throw new Error(error.message || "Insert failed");

        showToast("Experiment created.", "success");
        f.reset();
        await loadList();
      } catch (err) {
        showToast(err?.message || "Failed to save", "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Create";
      }
    });

    await loadList();
  }

  async function renderMessages(sb) {
    const el = document.getElementById("admin-content");
    el.innerHTML = `<h3 style="text-align:center;margin:0 0 10px;">Messages</h3><p style="text-align:center;color:var(--text-muted);">Loading…</p>`;

    const table = await resolveTable(sb, ["contact_messages"]);
    if (!table) return (el.innerHTML = `<p style="text-align:center;color:var(--text-muted);">No messages table found.</p>`);

    const { data, error } = await sb.from(table).select("*").order("created_at", { ascending: false });
    if (error) return (el.innerHTML = `<p style="text-align:center;color:var(--text-muted);">${esc(error.message)}</p>`);

    el.innerHTML = `
      <h3 style="text-align:center;margin:0 0 12px;">Messages</h3>
      <div class="pill-card hover-float" style="overflow:auto;">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>Message</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${(data || []).map((r) => `
              <tr>
                <td style="padding:10px;border-top:1px solid rgba(148,163,184,0.18);">${esc(r.name || "")}</td>
                <td style="padding:10px;border-top:1px solid rgba(148,163,184,0.18);">${esc(r.email || "")}</td>
                <td style="padding:10px;border-top:1px solid rgba(148,163,184,0.18);">${esc(r.message || "")}</td>
                <td style="padding:10px;border-top:1px solid rgba(148,163,184,0.18);">${esc(r.status || "open")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  async function renderNewsletter(sb) {
    const el = document.getElementById("admin-content");
    el.innerHTML = `<h3 style="text-align:center;margin:0 0 10px;">Newsletter</h3><p style="text-align:center;color:var(--text-muted);">Loading…</p>`;

    const table = await resolveTable(sb, ["newsletter_signups"]);
    if (!table) return (el.innerHTML = `<p style="text-align:center;color:var(--text-muted);">No newsletter table found.</p>`);

    const { data, error } = await sb.from(table).select("*").order("created_at", { ascending: false });
    if (error) return (el.innerHTML = `<p style="text-align:center;color:var(--text-muted);">${esc(error.message)}</p>`);

    el.innerHTML = `
      <h3 style="text-align:center;margin:0 0 12px;">Newsletter</h3>
      <div class="pill-card hover-float" style="overflow:auto;">
        <table class="admin-table">
          <thead><tr><th>Email</th></tr></thead>
          <tbody>
            ${(data || []).map((r) => `
              <tr><td style="padding:10px;border-top:1px solid rgba(148,163,184,0.18);">${esc(r.email || "")}</td></tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  async function renderApp() {
    const sb = window.sb;
    root.innerHTML = appShell();

    const content = document.getElementById("admin-content");
    const tabs = Array.from(root.querySelectorAll(".admin-tab"));

    async function goto(tab) {
      tabs.forEach((t) => t.classList.toggle("active", t.getAttribute("data-tab") === tab));
      content.innerHTML = "";

      if (tab === "signout") {
        await sb.auth.signOut();
        showToast("Signed out.", "success");
        return renderLogin();
      }
      if (tab === "stats") return renderStats();
      if (tab === "experiments") return renderExperiments(sb);
      if (tab === "messages") return renderMessages(sb);
      if (tab === "newsletter") return renderNewsletter(sb);
    }

    tabs.forEach((b) => b.addEventListener("click", () => goto(b.getAttribute("data-tab"))));
    await goto("experiments");
  }

  async function boot() {
    setLoading("Initializing…");
    try {
      await waitForSb();
    } catch {
      root.innerHTML = `
        <div style="text-align:center;">
          <h3 style="margin:0 0 6px;">Backend not ready</h3>
          <p style="color:var(--text-muted);margin:0;">window.sb is missing.</p>
          <p style="color:var(--text-muted);margin:10px 0 0;font-size:13px;">
            Check that <code>/js/supabaseClient.js</code> loads before <code>/admin/admin.js</code>.
          </p>
        </div>
      `;
      return;
    }

    const sb = window.sb;
    const { data } = await sb.auth.getSession();
    const email = (data?.session?.user?.email || "").toLowerCase();

    if (email && email === ADMIN_EMAIL.toLowerCase()) return renderApp();
    if (email && email !== ADMIN_EMAIL.toLowerCase()) await sb.auth.signOut();
    renderLogin();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
