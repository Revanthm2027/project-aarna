/* /admin/admin.js */
(function () {
  const ADMIN_EMAIL = "projectaarna@protonmail.com";
  const BUCKET = "experiments"; // Supabase Storage bucket name

  const root = document.getElementById("admin-root");
  if (!root) return;

  // ---------- small helpers ----------
  const esc = (s) => String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function toast(msg, type = "info") {
    let wrap = document.getElementById("admin-toasts");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "admin-toasts";
      wrap.style.position = "fixed";
      wrap.style.right = "16px";
      wrap.style.bottom = "16px";
      wrap.style.zIndex = "99999";
      wrap.style.display = "flex";
      wrap.style.flexDirection = "column";
      wrap.style.gap = "10px";
      document.body.appendChild(wrap);
    }
    const t = document.createElement("div");
    t.style.padding = "12px 14px";
    t.style.borderRadius = "12px";
    t.style.border = "1px solid rgba(255,255,255,0.18)";
    t.style.background = "rgba(10,18,40,0.92)";
    t.style.backdropFilter = "blur(10px)";
    t.style.color = "white";
    t.style.maxWidth = "420px";
    t.style.boxShadow = "0 10px 24px rgba(0,0,0,0.25)";
    t.style.fontSize = "14px";
    t.textContent = msg;

    if (type === "error") t.style.borderColor = "rgba(255,99,99,0.35)";
    if (type === "success") t.style.borderColor = "rgba(99,255,168,0.35)";
    wrap.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  function setLoading(title = "Loading...") {
    root.innerHTML = `
      <div style="text-align:center;">
        <h3 style="margin:0 0 6px;">${esc(title)}</h3>
        <p style="opacity:.75;margin:0;">Please wait.</p>
      </div>
    `;
  }

  function waitForSb(timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      if (window.sb) return resolve(window.sb);

      const t0 = Date.now();
      const onReady = () => {
        cleanup();
        resolve(window.sb);
      };

      const timer = setInterval(() => {
        if (window.sb) onReady();
        if (Date.now() - t0 > timeoutMs) {
          cleanup();
          reject(new Error("Supabase not ready (window.sb missing). Check /js/supabaseClient.js path/order."));
        }
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

  // ---------- render ----------
  function renderLogin(prefill = ADMIN_EMAIL) {
    root.innerHTML = `
      <div style="max-width:760px;margin:0 auto;">
        <h3 style="text-align:center;margin:0 0 8px;">Sign in</h3>
        <p style="text-align:center;opacity:.75;margin:0 0 18px;">
          Use your Supabase Auth admin credentials.
        </p>

        <form id="admin-login-form" class="contact-form" style="gap:12px;">
          <label>
            Email
            <input name="email" type="email" required value="${esc(prefill)}" />
          </label>
          <label>
            Password
            <input name="password" type="password" required placeholder="Your password" />
          </label>
          <button id="admin-login-btn" class="btn btn-primary" type="submit">Login</button>
          <p style="opacity:.65;margin:6px 0 0;font-size:13px;">
            Tip: Supabase → Authentication → Users → ensure this user is confirmed.
          </p>
        </form>
      </div>
    `;

    const form = document.getElementById("admin-login-form");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const sb = window.sb;
      if (!sb) return toast("Backend not ready (Supabase).", "error");

      const btn = document.getElementById("admin-login-btn");
      btn.disabled = true;
      btn.textContent = "Signing in...";

      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;

      try {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) return toast(error.message || "Login failed", "error");
        const userEmail = data?.user?.email || "";

        if (userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
          await sb.auth.signOut();
          return toast("Not allowed. Only the AARNA admin account can access.", "error");
        }

        toast("Signed in.", "success");
        await renderApp();
      } catch (err) {
        toast(err?.message || "Login crashed", "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Login";
      }
    });
  }

  function appShell(active = "experiments") {
    return `
      <div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center;margin-bottom:14px;">
        <button class="btn btn-secondary" data-tab="stats">Stats</button>
        <button class="btn btn-secondary" data-tab="experiments">Experiments</button>
        <button class="btn btn-secondary" data-tab="messages">Messages</button>
        <button class="btn btn-secondary" data-tab="newsletter">Newsletter</button>
        <button class="btn btn-secondary" data-tab="signout">Sign out</button>
      </div>
      <div id="admin-content"></div>
    `;
  }

  async function renderStats(sb) {
    const el = document.getElementById("admin-content");
    el.innerHTML = `
      <div style="text-align:center;">
        <h3 style="margin:0 0 10px;">Visitor count</h3>
        <div class="pill-card hover-float" style="max-width:520px;margin:0 auto;">
          <span class="pill-label">Unique visitors</span>
          <div id="uv" style="font-size:40px;font-weight:700;margin-top:8px;">—</div>
          <p style="opacity:.7;margin:10px 0 0;">Simple count shown from /api/visitor-stats.</p>
        </div>
      </div>
    `;

    try {
      const r = await fetch("/api/visitor-stats", { cache: "no-store" });
      if (!r.ok) throw new Error("visitor-stats not available");
      const j = await r.json();
      const n = j.unique_visitors ?? j.uniqueVisitors ?? j.total ?? null;
      document.getElementById("uv").textContent = (n ?? "—");
    } catch {
      document.getElementById("uv").textContent = "—";
      toast("Visitor stats not available yet (API).", "error");
    }
  }

  async function renderExperiments(sb) {
    const el = document.getElementById("admin-content");
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
        <h3 style="margin:0;text-align:center;flex:1;">Experiments</h3>
        <button id="new-exp-btn" class="btn btn-primary" type="button">+ New</button>
      </div>

      <div id="new-exp-wrap" class="pill-card hover-float" style="margin-top:12px;display:none;">
        <h4 style="margin:0 0 10px;">Add experiment</h4>
        <form id="new-exp-form" class="contact-form" style="gap:12px;">
          <label>Title <input name="title" required /></label>
          <label>Status <input name="status" placeholder="Upcoming / Planned / Design stage" /></label>
          <label>Description <textarea name="description" rows="4" required></textarea></label>

          <label style="display:flex;gap:10px;align-items:center;font-size:.95rem;opacity:.9;">
            <input type="checkbox" name="is_published" />
            Publish on live site
          </label>

          <label>Images (max 4)
            <input name="images" type="file" accept="image/*" multiple />
          </label>
          <p style="margin:0;opacity:.7;font-size:13px;">
            If images don’t show on live site, make the Storage bucket "${BUCKET}" public, or allow read access.
          </p>

          <button id="new-exp-submit" class="btn btn-primary" type="submit">Create</button>
        </form>
      </div>

      <div id="exp-list" class="experiments-grid" style="margin-top:16px;"></div>
    `;

    const newBtn = document.getElementById("new-exp-btn");
    const newWrap = document.getElementById("new-exp-wrap");
    newBtn.addEventListener("click", () => {
      newWrap.style.display = (newWrap.style.display === "none" ? "block" : "none");
    });

    const expTable = await resolveTable(sb, ["experiments"]);
    if (!expTable) return toast("Table 'experiments' not found.", "error");

    async function loadList() {
      const list = document.getElementById("exp-list");
      list.innerHTML = `<p style="opacity:.75;">Loading…</p>`;

      const { data, error } = await sb
        .from(expTable)
        .select("id,title,description,status,is_published,image_paths,created_at")
        .order("created_at", { ascending: false });

      if (error) {
        list.innerHTML = "";
        return toast(error.message || "Failed to load experiments", "error");
      }

      if (!data?.length) {
        list.innerHTML = `<p style="opacity:.75;">No experiments yet.</p>`;
        return;
      }

      list.innerHTML = data.map((x) => {
        const pub = x.is_published ? "Published" : "Hidden";
        return `
          <article class="experiment-card hover-float">
            <span class="experiment-status">${esc(x.status || pub)}</span>
            <h3>${esc(x.title || "")}</h3>
            <p>${esc(x.description || "")}</p>

            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">
              <button class="btn btn-secondary" data-act="toggle" data-id="${x.id}">
                ${x.is_published ? "Unpublish" : "Publish"}
              </button>
              <button class="btn btn-secondary" data-act="delete" data-id="${x.id}">Delete</button>
            </div>
          </article>
        `;
      }).join("");

      list.querySelectorAll("button[data-act]").forEach((b) => {
        b.addEventListener("click", async () => {
          const id = b.getAttribute("data-id");
          const act = b.getAttribute("data-act");

          if (act === "delete") {
            if (!confirm("Delete this experiment?")) return;
            const { error } = await sb.from(expTable).delete().eq("id", id);
            if (error) return toast(error.message || "Delete failed", "error");
            toast("Deleted.", "success");
            return loadList();
          }

          if (act === "toggle") {
            const row = data.find((r) => String(r.id) === String(id));
            const next = !row?.is_published;
            const { error } = await sb.from(expTable).update({ is_published: next }).eq("id", id);
            if (error) return toast(error.message || "Update failed", "error");
            toast(next ? "Published." : "Unpublished.", "success");
            return loadList();
          }
        });
      });
    }

    // create experiment (with max 4 images)
    const form = document.getElementById("new-exp-form");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const btn = document.getElementById("new-exp-submit");
      btn.disabled = true;
      btn.textContent = "Saving...";

      try {
        const title = form.elements.title.value.trim();
        const status = form.elements.status.value.trim();
        const description = form.elements.description.value.trim();
        const is_published = !!form.elements.is_published.checked;

        const files = Array.from(form.elements.images.files || []).slice(0, 4);
        if ((form.elements.images.files || []).length > 4) {
          toast("Only 4 images allowed. Extra files ignored.", "error");
        }

        const image_paths = [];
        for (const f of files) {
          const safeName = (f.name || "image").replace(/[^\w.\-]+/g, "_");
          const path = `exp/${crypto.randomUUID?.() || String(Date.now())}_${safeName}`;
          const { error: upErr } = await sb.storage.from(BUCKET).upload(path, f, { upsert: false, contentType: f.type });
          if (upErr) throw new Error(upErr.message || "Upload failed");
          image_paths.push(path);
        }

        const { error } = await sb.from(expTable).insert([{
          title,
          status: status || null,
          description,
          is_published,
          image_paths: image_paths.length ? image_paths : null
        }]);

        if (error) throw new Error(error.message || "Insert failed");

        toast("Experiment created.", "success");
        form.reset();
        newWrap.style.display = "none";
        await loadList();
      } catch (err) {
        toast(err?.message || "Failed to save", "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Create";
      }
    });

    await loadList();
  }

  async function renderMessages(sb) {
    const el = document.getElementById("admin-content");
    el.innerHTML = `<h3 style="text-align:center;margin:0 0 10px;">Messages</h3><p style="opacity:.75;text-align:center;">Loading…</p>`;

    const table = await resolveTable(sb, ["contact_messages", "contacts", "messages"]);
    if (!table) return (el.innerHTML = `<p style="text-align:center;opacity:.75;">No messages table found.</p>`);

    const { data, error } = await sb.from(table).select("*").order("created_at", { ascending: false });
    if (error) return (el.innerHTML = `<p style="text-align:center;opacity:.75;">${esc(error.message)}</p>`);

    el.innerHTML = `
      <h3 style="text-align:center;margin:0 0 10px;">Messages</h3>
      <div class="pill-card hover-float" style="overflow:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left;padding:10px;">Name</th>
              <th style="text-align:left;padding:10px;">Email</th>
              <th style="text-align:left;padding:10px;">Message</th>
            </tr>
          </thead>
          <tbody>
            ${(data || []).map((r) => `
              <tr>
                <td style="padding:10px;border-top:1px solid rgba(255,255,255,0.08);">${esc(r.name || "")}</td>
                <td style="padding:10px;border-top:1px solid rgba(255,255,255,0.08);">${esc(r.email || "")}</td>
                <td style="padding:10px;border-top:1px solid rgba(255,255,255,0.08);">${esc(r.message || "")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  async function renderNewsletter(sb) {
    const el = document.getElementById("admin-content");
    el.innerHTML = `<h3 style="text-align:center;margin:0 0 10px;">Newsletter</h3><p style="opacity:.75;text-align:center;">Loading…</p>`;

    const table = await resolveTable(sb, ["newsletter_signups", "newsletter", "subscribers"]);
    if (!table) return (el.innerHTML = `<p style="text-align:center;opacity:.75;">No newsletter table found.</p>`);

    const { data, error } = await sb.from(table).select("*").order("created_at", { ascending: false });
    if (error) return (el.innerHTML = `<p style="text-align:center;opacity:.75;">${esc(error.message)}</p>`);

    el.innerHTML = `
      <h3 style="text-align:center;margin:0 0 10px;">Newsletter</h3>
      <div class="pill-card hover-float" style="overflow:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left;padding:10px;">Email</th>
            </tr>
          </thead>
          <tbody>
            ${(data || []).map((r) => `
              <tr>
                <td style="padding:10px;border-top:1px solid rgba(255,255,255,0.08);">${esc(r.email || r.user_email || "")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  async function renderApp() {
    const sb = window.sb;
    root.innerHTML = appShell("experiments");

    const content = document.getElementById("admin-content");
    content.innerHTML = "";

    async function goto(tab) {
      if (tab === "signout") {
        await sb.auth.signOut();
        toast("Signed out.", "success");
        return renderLogin();
      }
      if (tab === "stats") return renderStats(sb);
      if (tab === "experiments") return renderExperiments(sb);
      if (tab === "messages") return renderMessages(sb);
      if (tab === "newsletter") return renderNewsletter(sb);
    }

    root.querySelectorAll("button[data-tab]").forEach((b) => {
      b.addEventListener("click", () => goto(b.getAttribute("data-tab")));
    });

    await goto("experiments");
  }

  async function boot() {
    setLoading("Initializing...");
    try {
      await waitForSb();
    } catch (e) {
      root.innerHTML = `
        <div style="text-align:center;">
          <h3 style="margin:0 0 6px;">Backend not ready</h3>
          <p style="opacity:.75;margin:0;">
            ${esc(e.message)}
          </p>
          <p style="opacity:.65;margin:10px 0 0;font-size:13px;">
            Check that <code>/js/supabaseClient.js</code> loads (Network tab) and runs before <code>/admin/admin.js</code>.
          </p>
        </div>
      `;
      return;
    }

    const sb = window.sb;

    const { data } = await sb.auth.getSession();
    const email = data?.session?.user?.email || "";

    if (email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      return renderApp();
    }

    if (email && email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      await sb.auth.signOut();
    }

    renderLogin();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
