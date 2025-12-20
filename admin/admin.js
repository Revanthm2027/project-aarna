/* admin/admin.js
   Project AARNA Admin Console
   - Experiments: Add/Edit/Delete + Publish toggle
   - NEW: Upload up to 4 images per experiment (Supabase Storage bucket: experiments)
*/

(function () {
  const ADMIN_EMAIL = "projectaarna@protonmail.com";
  const BUCKET = "experiments";
  const MAX_IMAGES = 4;
  const MAX_MB = 4;

  const root = document.getElementById("admin-root");
  if (!root) return console.error("[ADMIN] #admin-root not found");

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

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
    try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
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

  function setLoading(v) {
    root.setAttribute("data-loading", v ? "true" : "false");
  }

  function safeFileName(name) {
    return String(name || "image")
      .toLowerCase()
      .replace(/[^a-z0-9.\-_]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 70) || "image";
  }

  function isAllowedImage(file) {
    return ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  }

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

  function publicUrl(path) {
    if (!path) return null;
    try {
      const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
      return data?.publicUrl || null;
    } catch {
      return null;
    }
  }

  async function uploadOne(expId, file) {
    const maxBytes = MAX_MB * 1024 * 1024;
    if (file.size > maxBytes) throw new Error(`Image too large (max ${MAX_MB}MB).`);
    if (!isAllowedImage(file)) throw new Error("Only JPG / PNG / WEBP allowed.");

    const path = `${expId}/${Date.now()}-${safeFileName(file.name)}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: "3600",
    });
    if (error) throw error;
    return path;
  }

  async function deleteMany(paths) {
    const arr = (paths || []).filter(Boolean);
    if (!arr.length) return;
    const { error } = await sb.storage.from(BUCKET).remove(arr);
    if (error) console.warn("[ADMIN] image delete failed:", error.message);
  }

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

  const state = { user: null, tab: "overview", msgFilter: "open" };

  function render() {
    root.innerHTML = "";
    if (!state.user) return renderLogin();

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

      <div class="admin-tabs" role="tablist">
        <button class="tab-btn" data-tab="overview" type="button">Overview</button>
        <button class="tab-btn" data-tab="messages" type="button">Messages</button>
        <button class="tab-btn" data-tab="experiments" type="button">Experiments</button>
        <button class="tab-btn" data-tab="newsletter" type="button">Newsletter</button>
      </div>

      <div class="admin-panel" id="admin-panel"></div>
    `;
    root.appendChild(shell);

    $$(".tab-btn", root).forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === state.tab);
      b.addEventListener("click", () => { state.tab = b.dataset.tab; render(); });
    });

    $("#admin-refresh", root).addEventListener("click", () => render());
    $("#admin-logout", root).addEventListener("click", doLogout);

    const panel = $("#admin-panel", root);
    if (state.tab === "overview") renderOverview(panel);
    if (state.tab === "messages") renderMessages(panel);
    if (state.tab === "experiments") renderExperiments(panel);
    if (state.tab === "newsletter") renderNewsletter(panel);
  }

  function renderLogin() {
    const card = document.createElement("div");
    card.className = "admin-card";
    card.innerHTML = `
      <h3 style="text-align:center;margin:0 0 .25rem;">Admin</h3>
      <p style="text-align:center;margin:0 0 1.25rem;color:var(--text-muted);">Sign in to access the console.</p>
      <form id="admin-login-form" class="admin-form">
        <label>Email
          <input id="admin-email" type="email" autocomplete="username" required placeholder="${ADMIN_EMAIL}">
        </label>
        <label>Password
          <input id="admin-pass" type="password" autocomplete="current-password" required placeholder="••••••••">
        </label>
        <button class="btn btn-primary" type="submit">Login</button>
      </form>
      <p class="admin-hint">Only <strong>${ADMIN_EMAIL}</strong> is allowed.</p>
    `;
    root.appendChild(card);

    $("#admin-login-form", root).addEventListener("submit", async (e) => {
      e.preventDefault();
      setLoading(true);
      try {
        const email = $("#admin-email", root).value.trim();
        const password = $("#admin-pass", root).value;

        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const u = data?.user;
        if (!u || u.email !== ADMIN_EMAIL) {
          await sb.auth.signOut();
          toast("Not authorized.", "error");
          setLoading(false);
          return;
        }

        state.user = u;
        toast("Logged in.", "success");
        setLoading(false);
        render();
      } catch (err) {
        console.error(err);
        toast(err?.message || "Login failed.", "error");
        setLoading(false);
      }
    });
  }

  async function doLogout() {
    try { await sb.auth.signOut(); } catch {}
    state.user = null;
    toast("Logged out.", "info");
    render();
  }

  async function renderOverview(panel) {
    panel.innerHTML = `
      <div class="admin-grid">
        <div class="stat-card">
          <h4>Unique visitors</h4>
          <div class="stat-value" id="stat-visitors">—</div>
          <p class="stat-sub">Lifetime unique IP hashes.</p>
        </div>
        <div class="stat-card">
          <h4>Open messages</h4>
          <div class="stat-value" id="stat-open">—</div>
          <p class="stat-sub">Not closed.</p>
        </div>
        <div class="stat-card">
          <h4>Published experiments</h4>
          <div class="stat-value" id="stat-exp">—</div>
          <p class="stat-sub">Visible on live site.</p>
        </div>
      </div>
    `;

    setLoading(true);

    try {
      const r = await fetch("/api/visitor-stats", { cache: "no-store" });
      const j = await r.json();
      $("#stat-visitors", panel).textContent =
        typeof j?.unique_visitors === "number" ? String(j.unique_visitors) : "—";
    } catch {}

    const openCount = (await safeCount("contact_messages", (q) => q.eq("status", "open"))) ?? "—";
    const expCount = (await safeCount("experiments", (q) => q.eq("is_published", true))) ?? "—";

    $("#stat-open", panel).textContent = String(openCount);
    $("#stat-exp", panel).textContent = String(expCount);

    setLoading(false);
  }

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
      render();
    });

    setLoading(true);

    const rows = await safeSelect("contact_messages", (q) => {
      let qq = q.select("*").order("created_at", { ascending: false }).limit(200);
      if (state.msgFilter === "open") qq = qq.eq("status", "open");
      if (state.msgFilter === "closed") qq = qq.eq("status", "closed");
      return qq;
    });

    if (rows === null) {
      $("#msg-list", panel).innerHTML = `<div class="empty">Could not load <code>contact_messages</code>.</div>`;
      setLoading(false);
      return;
    }

    if (!rows.length) {
      $("#msg-list", panel).innerHTML = `<div class="empty">No messages.</div>`;
      setLoading(false);
      return;
    }

    $("#msg-list", panel).innerHTML = rows.map((m) => {
      const status = m.status || "open";
      return `
        <div class="list-item">
          <div class="list-main">
            <div class="list-title">
              ${escapeHtml(m.name || "—")}
              <span class="pill ${status === "closed" ? "pill-muted" : "pill-blue"}">${escapeHtml(status)}</span>
            </div>
            <div class="list-meta">
              <span>${escapeHtml(m.email || "—")}</span>
              <span>•</span>
              <span>${escapeHtml(formatDate(m.created_at))}</span>
            </div>
            <div class="list-body">${escapeHtml(m.message || "")}</div>
          </div>

          <div class="list-actions">
            ${
              status === "closed"
                ? `<button class="btn btn-secondary" data-action="reopen" data-id="${escapeHtml(m.id)}" type="button">Reopen</button>`
                : `<button class="btn btn-secondary" data-action="close" data-id="${escapeHtml(m.id)}" type="button">Close</button>`
            }
            <button class="btn btn-secondary" data-action="delete" data-id="${escapeHtml(m.id)}" type="button">Delete</button>
          </div>
        </div>`;
    }).join("");

    $("#msg-list", panel).addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");

      try {
        setLoading(true);

        if (action === "close") {
          const { error } = await sb.from("contact_messages").update({ status: "closed" }).eq("id", id);
          if (error) throw error;
          toast("Closed.", "success");
        }

        if (action === "reopen") {
          const { error } = await sb.from("contact_messages").update({ status: "open" }).eq("id", id);
          if (error) throw error;
          toast("Reopened.", "success");
        }

        if (action === "delete") {
          if (!confirm("Delete this message?")) { setLoading(false); return; }
          const { error } = await sb.from("contact_messages").delete().eq("id", id);
          if (error) throw error;
          toast("Deleted.", "success");
        }

        setLoading(false);
        render();
      } catch (err) {
        console.error(err);
        toast(err?.message || "Action failed.", "error");
        setLoading(false);
      }
    });

    setLoading(false);
  }

  // ---------- Experiments (multi-image) ----------
  async function renderExperiments(panel) {
    panel.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-head">
          <h3>Experiments</h3>
          <div class="row">
            <button class="btn btn-primary" id="exp-new" type="button">+ New</button>
          </div>
        </div>

        <div id="exp-form-wrap" style="display:none;"></div>
        <div id="exp-list" class="admin-list">Loading…</div>
      </div>
    `;

    $("#exp-new", panel).addEventListener("click", () => showExperimentForm(panel, null));

    setLoading(true);

    const rows = await safeSelect("experiments", (q) =>
      q.select("*").order("created_at", { ascending: false }).limit(200)
    );

    if (rows === null) {
      $("#exp-list", panel).innerHTML = `<div class="empty">Could not load <code>experiments</code>.</div>`;
      setLoading(false);
      return;
    }

    $("#exp-list", panel).innerHTML = rows.length ? rows.map((x) => {
      const pub = !!x.is_published;
      const paths = Array.isArray(x.image_paths) && x.image_paths.length ? x.image_paths : (x.image_path ? [x.image_path] : []);
      const count = paths.length;

      return `
        <div class="list-item">
          <div class="list-main">
            <div class="list-title">
              ${escapeHtml(x.title || "Untitled")}
              <span class="pill ${pub ? "pill-green" : "pill-muted"}">${pub ? "published" : "draft"}</span>
              <span class="pill pill-muted">${count} image${count === 1 ? "" : "s"}</span>
            </div>

            ${count ? renderAdminMiniCarousel(paths, x.image_alt || x.title || "Experiment image") : `<div style="opacity:.65;margin-top:8px;">No images</div>`}

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
    }).join("") : `<div class="empty">No experiments yet. Click <strong>+ New</strong>.</div>`;

    $("#exp-list", panel).addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");
      if (!id) return;

      try {
        if (action === "edit") {
          const row = rows.find((r) => String(r.id) === String(id));
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
          if (!confirm("Delete this experiment?")) { setLoading(false); return; }

          const row = rows.find((r) => String(r.id) === String(id));
          const paths = Array.isArray(row?.image_paths) && row.image_paths.length
            ? row.image_paths
            : (row?.image_path ? [row.image_path] : []);
          await deleteMany(paths);

          const { error } = await sb.from("experiments").delete().eq("id", id);
          if (error) throw error;
          toast("Deleted.", "success");
        }

        setLoading(false);
        render();
      } catch (err) {
        console.error(err);
        toast(err?.message || "Action failed.", "error");
        setLoading(false);
      }
    });

    setLoading(false);
  }

  function renderAdminMiniCarousel(paths, alt) {
    const slides = paths.slice(0, MAX_IMAGES).map((p) => publicUrl(p)).filter(Boolean);
    if (!slides.length) return `<div style="opacity:.65;margin-top:8px;">No images</div>`;

    const dots = slides.map((_, i) => `<span class="dot ${i === 0 ? "active" : ""}"></span>`).join("");

    return `
      <div class="exp-carousel" data-carousel="1" style="margin-top:10px;">
        <div class="exp-track">
          ${slides.map((u) => `
            <div class="exp-slide">
              <img src="${u}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">
            </div>
          `).join("")}
        </div>
        <div class="exp-dots">${dots}</div>
      </div>
    `;
  }

  function showExperimentForm(panel, row) {
    const wrap = $("#exp-form-wrap", panel);
    wrap.style.display = "block";

    const isEdit = !!row;
    const existingPaths = Array.isArray(row?.image_paths) && row.image_paths.length
      ? row.image_paths.slice(0, MAX_IMAGES)
      : (row?.image_path ? [row.image_path] : []);

    wrap.innerHTML = `
      <div class="admin-subcard">
        <div class="admin-subhead">
          <h4 style="margin:0;text-align:center;">${isEdit ? "Edit experiment" : "New experiment"}</h4>
          <p style="margin:.4rem 0 0;text-align:center;opacity:.75;">
            Upload up to ${MAX_IMAGES} images (JPG/PNG/WEBP, max ${MAX_MB}MB each).
          </p>
        </div>

        <form id="exp-form" class="admin-form">
          <label>Status tag (e.g. Upcoming / Planned)
            <input id="exp-status" type="text" placeholder="Upcoming" value="${escapeHtml(row?.status || "")}">
          </label>

          <label>Title
            <input id="exp-title" type="text" required placeholder="Pilot · XYZ mangrove reserve" value="${escapeHtml(row?.title || "")}">
          </label>

          <label>Description
            <textarea id="exp-desc" rows="4" required placeholder="Short description…">${escapeHtml(row?.description || "")}</textarea>
          </label>

          <label>Image alt text (applies to all)
            <input id="exp-alt" type="text" placeholder="Mangrove sampling plot" value="${escapeHtml(row?.image_alt || "")}">
          </label>

          <label>Upload images (optional, max ${MAX_IMAGES})
            <input id="exp-images" type="file" multiple accept="image/jpeg,image/png,image/webp">
          </label>

          <div id="exp-preview" class="exp-preview">
            ${renderPreview(existingPaths, row?.image_alt || row?.title || "Experiment image")}
          </div>

          <label class="row-check">
            <input id="exp-pub" type="checkbox" ${row?.is_published ? "checked" : ""}>
            Publish on live site
          </label>

          <div class="row-actions">
            <button class="btn btn-primary" type="submit" id="exp-save">${isEdit ? "Save changes" : "Create"}</button>
            <button class="btn btn-secondary" type="button" id="exp-cancel">Cancel</button>
            ${
              existingPaths.length
                ? `<button class="btn btn-secondary" type="button" id="exp-remove-all">Remove all images</button>`
                : ``
            }
          </div>
        </form>
      </div>
    `;

    $("#exp-cancel", wrap).addEventListener("click", () => {
      wrap.style.display = "none";
      wrap.innerHTML = "";
    });

    const fileInput = $("#exp-images", wrap);
    const preview = $("#exp-preview", wrap);

    fileInput.addEventListener("change", () => {
      const files = Array.from(fileInput.files || []);
      if (!files.length) return;

      if (files.length > MAX_IMAGES) {
        toast(`Max ${MAX_IMAGES} images. Select up to ${MAX_IMAGES}.`, "error");
      }

      const take = files.slice(0, MAX_IMAGES);
      preview.innerHTML = `
        <div class="thumb-grid">
          ${take.map((f) => {
            const u = URL.createObjectURL(f);
            return `<div class="thumb"><img src="${u}" alt="preview"></div>`;
          }).join("")}
        </div>
        <div class="exp-dots-row">${take.map((_, i) => `<span class="dot ${i===0?"active":""}"></span>`).join("")}</div>
      `;
    });

    const removeAll = $("#exp-remove-all", wrap);
    if (removeAll) {
      removeAll.addEventListener("click", async () => {
        if (!row?.id) return;
        if (!confirm("Remove all images for this experiment?")) return;

        try {
          setLoading(true);
          await deleteMany(existingPaths);
          const { error } = await sb.from("experiments").update({ image_paths: [], image_path: null }).eq("id", row.id);
          if (error) throw error;
          toast("Images removed.", "success");
          setLoading(false);
          render();
        } catch (err) {
          console.error(err);
          toast(err?.message || "Remove failed.", "error");
          setLoading(false);
        }
      });
    }

    $("#exp-form", wrap).addEventListener("submit", async (e) => {
      e.preventDefault();

      const payload = {
        status: $("#exp-status", wrap).value.trim(),
        title: $("#exp-title", wrap).value.trim(),
        description: $("#exp-desc", wrap).value.trim(),
        image_alt: $("#exp-alt", wrap).value.trim(),
        is_published: $("#exp-pub", wrap).checked,
      };

      const files = Array.from(fileInput.files || []).slice(0, MAX_IMAGES);

      const saveBtn = $("#exp-save", wrap);
      const oldTxt = saveBtn.textContent;
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";

      try {
        setLoading(true);

        if (isEdit) {
          const { error } = await sb.from("experiments").update(payload).eq("id", row.id);
          if (error) throw error;

          if (files.length) {
            // replace images
            await deleteMany(existingPaths);
            const uploaded = [];
            for (const f of files) uploaded.push(await uploadOne(row.id, f));

            const { error: e2 } = await sb.from("experiments").update({
              image_paths: uploaded,
              image_path: uploaded[0] || null
            }).eq("id", row.id);
            if (e2) throw e2;
          }

          toast("Updated.", "success");
        } else {
          // create to get id
          const { data: created, error } = await sb.from("experiments").insert(payload).select("*").single();
          if (error) throw error;

          if (files.length) {
            const uploaded = [];
            for (const f of files) uploaded.push(await uploadOne(created.id, f));
            const { error: e2 } = await sb.from("experiments").update({
              image_paths: uploaded,
              image_path: uploaded[0] || null
            }).eq("id", created.id);
            if (e2) throw e2;
          }

          toast("Created.", "success");
        }

        setLoading(false);
        render();
      } catch (err) {
        console.error(err);
        toast(err?.message || "Save failed.", "error");
        setLoading(false);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = oldTxt;
      }
    });
  }

  function renderPreview(paths, alt) {
    const urls = paths.map(publicUrl).filter(Boolean);
    if (!urls.length) return `<div style="opacity:.7;text-align:center;">No images selected</div>`;

    return `
      <div class="exp-carousel" data-carousel="1">
        <div class="exp-track">
          ${urls.map((u) => `
            <div class="exp-slide">
              <img src="${u}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">
            </div>
          `).join("")}
        </div>
        <div class="exp-dots">${urls.map((_, i) => `<span class="dot ${i===0?"active":""}"></span>`).join("")}</div>
      </div>
    `;
  }

  async function renderNewsletter(panel) {
    panel.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-head">
          <h3>Newsletter</h3>
          <div class="row"><button class="btn btn-secondary" id="news-copy" type="button">Copy emails</button></div>
        </div>
        <div id="news-list" class="admin-list">Loading…</div>
      </div>
    `;

    setLoading(true);

    let emails = await safeSelect("newsletter_subscribers", (q) =>
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

    $("#news-list", panel).innerHTML = emails.map((n) => `
      <div class="list-item">
        <div class="list-main">
          <div class="list-title">${escapeHtml(n.email || "—")}</div>
          <div class="list-meta">${escapeHtml(formatDate(n.created_at))}</div>
        </div>
      </div>`).join("");

    $("#news-copy", panel).addEventListener("click", async () => {
      const list = emails.map((x) => x.email).filter(Boolean).join(", ");
      try { await navigator.clipboard.writeText(list); toast("Copied.", "success"); }
      catch { toast("Copy failed.", "error"); }
    });

    setLoading(false);
  }

  // init + carousel dot sync inside admin
  function initCarouselDots(container) {
    const track = container.querySelector(".exp-track");
    const dots = Array.from(container.querySelectorAll(".dot"));
    if (!track || dots.length <= 1) return;

    const onScroll = () => {
      const w = track.clientWidth || 1;
      const idx = Math.round(track.scrollLeft / w);
      dots.forEach((d, i) => d.classList.toggle("active", i === idx));
    };

    track.addEventListener("scroll", () => requestAnimationFrame(onScroll), { passive: true });
    onScroll();
  }

  function initAllAdminCarousels() {
    document.querySelectorAll(".exp-carousel[data-carousel='1']").forEach(initCarouselDots);
  }

  // patch render() to init carousels after DOM paint
  const _render = render;
  render = function () {
    _render();
    requestAnimationFrame(initAllAdminCarousels);
  };

  async function init() {
    try {
      const { data } = await sb.auth.getSession();
      const session = data?.session;
      if (session?.user?.email === ADMIN_EMAIL) state.user = session.user;
      else if (session) { await sb.auth.signOut(); state.user = null; }
    } catch { state.user = null; }
    render();
  }

  init();
})();
