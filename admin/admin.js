document.addEventListener("DOMContentLoaded", () => {
  const ADMIN_EMAIL = "projectaarna@protonmail.com";
  const sb = window.sb;

  // ---------- Theme ----------
  const root = document.documentElement;
  const themeToggle = document.getElementById("theme-toggle");
  const THEME_KEY = "aarna-theme";
  root.setAttribute("data-theme", localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark");
  if (themeToggle) {
    const icon = themeToggle.querySelector(".theme-icon");
    if (icon) icon.textContent = root.getAttribute("data-theme") === "light" ? "☀︎" : "☾";
    themeToggle.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      localStorage.setItem(THEME_KEY, next);
      root.setAttribute("data-theme", next);
      const icon2 = themeToggle.querySelector(".theme-icon");
      if (icon2) icon2.textContent = next === "light" ? "☀︎" : "☾";
    });
  }

  // ---------- DOM ----------
  const authCard = document.getElementById("auth-card");
  const dash = document.getElementById("dashboard");
  const form = document.getElementById("admin-login-form");
  const statusEl = document.getElementById("login-status");
  const logoutBtn = document.getElementById("logout-btn");
  const refreshBtn = document.getElementById("refresh-btn");

  // Tabs
  const tabBtns = Array.from(document.querySelectorAll(".admin-tab"));
  const panels = {
    stats: document.getElementById("panel-stats"),
    messages: document.getElementById("panel-messages"),
    experiments: document.getElementById("panel-experiments"),
    newsletter: document.getElementById("panel-newsletter"),
  };

  function setTab(name) {
    tabBtns.forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    Object.entries(panels).forEach(([k, el]) => {
      if (!el) return;
      el.style.display = k === name ? "block" : "none";
    });
  }
  tabBtns.forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));

  // Stats elements
  const statNew = document.getElementById("stat-new");
  const statContacted = document.getElementById("stat-contacted");
  const statClosed = document.getElementById("stat-closed");
  const statSubs = document.getElementById("stat-subs");
  const statVToday = document.getElementById("stat-v-today");
  const statV7d = document.getElementById("stat-v-7d");
  const statV30d = document.getElementById("stat-v-30d");
  const statPV30d = document.getElementById("stat-pv-30d");

  // Messages tables
  const tbodyNew = document.getElementById("contacts-new-tbody");
  const tbodyContacted = document.getElementById("contacts-contacted-tbody");
  const tbodyClosed = document.getElementById("contacts-closed-tbody");

  // Newsletter
  const subsTbody = document.getElementById("subs-tbody");

  // Experiments
  const expTbody = document.getElementById("experiments-tbody");
  const newExpBtn = document.getElementById("new-exp-btn");
  const expFormCard = document.getElementById("experiment-form-card");

  const expForm = document.getElementById("experiment-form");
  const expFormTitle = document.getElementById("exp-form-title");
  const expId = document.getElementById("exp-id");
  const expTitle = document.getElementById("exp-title");
  const expStatus = document.getElementById("exp-status");
  const expLocation = document.getElementById("exp-location");
  const expSummary = document.getElementById("exp-summary");
  const expSort = document.getElementById("exp-sort");
  const expPublished = document.getElementById("exp-published");
  const expSaveBtn = document.getElementById("exp-save-btn");
  const expCancelBtn = document.getElementById("exp-cancel-btn");
  const expDeleteBtn = document.getElementById("exp-delete-btn");
  const expStatusText = document.getElementById("exp-status-text");

  const esc = (s) =>
    String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");

  const showLogin = (msg = "") => {
    if (authCard) authCard.style.display = "block";
    if (dash) dash.style.display = "none";
    if (statusEl) statusEl.textContent = msg;
  };

  const showDash = () => {
    if (authCard) authCard.style.display = "none";
    if (dash) dash.style.display = "block";
  };

  function openExpForm(mode = "new") {
    if (!expFormCard) return;
    expFormCard.style.display = "block";
    if (mode === "new") {
      if (expFormTitle) expFormTitle.textContent = "New experiment";
      if (expDeleteBtn) expDeleteBtn.style.display = "none";
    }
  }

  function closeExpForm() {
    if (!expFormCard) return;
    expFormCard.style.display = "none";
    resetExpForm();
  }

  function resetExpForm() {
    if (expId) expId.value = "";
    if (expTitle) expTitle.value = "";
    if (expStatus) expStatus.value = "Upcoming";
    if (expLocation) expLocation.value = "";
    if (expSummary) expSummary.value = "";
    if (expSort) expSort.value = 100;
    if (expPublished) expPublished.checked = true;
    if (expStatusText) expStatusText.textContent = "";
  }

  async function enforceAdmin() {
    if (!sb) return { ok: false, reason: "Supabase not initialized. Check script paths." };

    const { data: userRes, error: userErr } = await sb.auth.getUser();
    if (userErr) return { ok: false, reason: `Auth error: ${userErr.message}` };

    const user = userRes?.user;
    if (!user) return { ok: false, reason: "" };

    if ((user.email || "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      await sb.auth.signOut();
      return { ok: false, reason: "Access denied (admin email only)." };
    }

    const { data: prof, error } = await sb.from("profiles").select("role").eq("id", user.id).single();
    if (error) return { ok: false, reason: `profiles policy error: ${error.message}` };
    if (!prof || prof.role !== "admin") return { ok: false, reason: "Role is not admin. Set role='admin'." };

    return { ok: true };
  }

  function attachStatusHandlers(tbody) {
    if (!tbody) return;
    tbody.querySelectorAll(".status-select").forEach((sel) => {
      sel.addEventListener("change", async (e) => {
        const id = Number(e.target.getAttribute("data-id"));
        const status = e.target.value;
        const { error } = await sb.from("contacts").update({ status }).eq("id", id);
        if (error) console.error("[AARNA] status update error:", error);
        await loadMessages();
        await loadStatsOnly();
      });
    });
  }

  function renderContacts(tbody, rows) {
    if (!tbody) return;
    tbody.innerHTML = (rows || [])
      .map((r) => {
        const time = r.created_at ? new Date(r.created_at).toLocaleString() : "—";
        const status = r.status || "new";
        return `
          <tr style="border-top:1px solid rgba(148,163,184,0.25);">
            <td style="padding:10px; color: var(--text-muted); white-space:nowrap;">${esc(time)}</td>
            <td style="padding:10px;">${esc(r.name)}</td>
            <td style="padding:10px;">
              <a href="mailto:${esc(r.email)}" style="color: var(--metal-cyan); text-decoration:none;">${esc(r.email)}</a>
            </td>
            <td style="padding:10px; color: var(--text-muted); max-width: 520px;">${esc(r.message)}</td>
            <td style="padding:10px;">
              <select data-id="${r.id}" class="status-select"
                style="padding:6px; border-radius:10px; background: rgba(15,23,42,0.98); color: var(--text-main); border:1px solid rgba(148,163,184,0.6);">
                ${["new","contacted","closed"].map(s => `<option ${s===status?"selected":""} value="${s}">${s}</option>`).join("")}
              </select>
            </td>
          </tr>
        `;
      })
      .join("");
    attachStatusHandlers(tbody);
  }

  async function loadStatsOnly() {
    const [newRes, contactedRes, closedRes, subsRes] = await Promise.all([
      sb.from("contacts").select("id").eq("status", "new"),
      sb.from("contacts").select("id").eq("status", "contacted"),
      sb.from("contacts").select("id").eq("status", "closed"),
      sb.from("newsletter_subscribers").select("id"),
    ]);

    if (statNew) statNew.textContent = String((newRes.data || []).length);
    if (statContacted) statContacted.textContent = String((contactedRes.data || []).length);
    if (statClosed) statClosed.textContent = String((closedRes.data || []).length);
    if (statSubs) statSubs.textContent = String((subsRes.data || []).length);

    // Visitor stats (serverless); if not available locally, just show —
    try {
      const r = await fetch("/api/visitor-stats", { cache: "no-store" });
      if (!r.ok) throw new Error("visitor-stats failed");
      const j = await r.json();
      if (statVToday) statVToday.textContent = String(j.unique_today ?? "—");
      if (statV7d) statV7d.textContent = String(j.unique_7d ?? "—");
      if (statV30d) statV30d.textContent = String(j.unique_30d ?? "—");
      if (statPV30d) statPV30d.textContent = String(j.pageviews_30d ?? "—");
    } catch {
      if (statVToday) statVToday.textContent = "—";
      if (statV7d) statV7d.textContent = "—";
      if (statV30d) statV30d.textContent = "—";
      if (statPV30d) statPV30d.textContent = "—";
    }
  }

  async function loadMessages() {
    const [newRes, contactedRes, closedRes] = await Promise.all([
      sb.from("contacts").select("id,name,email,message,created_at,status").eq("status", "new").order("created_at", { ascending: false }).limit(120),
      sb.from("contacts").select("id,name,email,message,created_at,status").eq("status", "contacted").order("created_at", { ascending: false }).limit(120),
      sb.from("contacts").select("id,name,email,message,created_at,status").eq("status", "closed").order("created_at", { ascending: false }).limit(200),
    ]);

    renderContacts(tbodyNew, newRes.data || []);
    renderContacts(tbodyContacted, contactedRes.data || []);
    renderContacts(tbodyClosed, closedRes.data || []);
  }

  async function loadNewsletter() {
    const subsRes = await sb.from("newsletter_subscribers").select("email,created_at").order("created_at", { ascending: false }).limit(500);
    const subs = subsRes.data || [];
    if (!subsTbody) return;

    subsTbody.innerHTML = subs
      .map((r) => {
        const time = r.created_at ? new Date(r.created_at).toLocaleString() : "—";
        return `<tr style="border-top:1px solid rgba(148,163,184,0.25);">
          <td style="padding:10px; color: var(--text-muted); white-space:nowrap;">${esc(time)}</td>
          <td style="padding:10px;">${esc(r.email)}</td>
        </tr>`;
      })
      .join("");
  }

  async function loadExperiments() {
    const res = await sb
      .from("experiments")
      .select("id,title,status,summary,location,sort_order,is_published,created_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    const rows = res.data || [];
    if (!expTbody) return;

    expTbody.innerHTML = rows
      .map((e) => {
        return `
          <tr style="border-top:1px solid rgba(148,163,184,0.25);">
            <td style="padding:10px;">${esc(e.title)}</td>
            <td style="padding:10px; color: var(--text-muted); white-space:nowrap;">${esc(e.status)}</td>
            <td style="padding:10px;">${e.is_published ? "Yes" : "No"}</td>
            <td style="padding:10px;">${Number(e.sort_order ?? 100)}</td>
            <td style="padding:10px; display:flex; gap:8px; flex-wrap:wrap; justify-content:center;">
              <button class="btn btn-secondary exp-edit" data-id="${e.id}">Edit</button>
              <button class="btn btn-secondary exp-toggle" data-id="${e.id}" data-next="${e.is_published ? "false" : "true"}">
                ${e.is_published ? "Unpublish" : "Publish"}
              </button>
            </td>
          </tr>
        `;
      })
      .join("");

    expTbody.querySelectorAll(".exp-edit").forEach((b) => {
      b.addEventListener("click", async () => {
        const id = Number(b.dataset.id);
        const one = rows.find((x) => x.id === id);
        if (!one) return;

        openExpForm("edit");
        if (expFormTitle) expFormTitle.textContent = "Edit experiment";
        if (expDeleteBtn) expDeleteBtn.style.display = "inline-flex";

        if (expId) expId.value = String(one.id);
        if (expTitle) expTitle.value = one.title || "";
        if (expStatus) expStatus.value = one.status || "Upcoming";
        if (expLocation) expLocation.value = one.location || "";
        if (expSummary) expSummary.value = one.summary || "";
        if (expSort) expSort.value = String(one.sort_order ?? 100);
        if (expPublished) expPublished.checked = !!one.is_published;
        if (expStatusText) expStatusText.textContent = "";
      });
    });

    expTbody.querySelectorAll(".exp-toggle").forEach((b) => {
      b.addEventListener("click", async () => {
        const id = Number(b.dataset.id);
        const next = b.dataset.next === "true";
        await sb.from("experiments").update({ is_published: next, updated_at: new Date().toISOString() }).eq("id", id);
        await loadExperiments();
      });
    });
  }

  async function loadAll() {
    await Promise.all([loadStatsOnly(), loadMessages(), loadNewsletter(), loadExperiments()]);
  }

  // ---------- Boot ----------
  (async () => {
    const gate = await enforceAdmin();
    if (!gate.ok) return showLogin(gate.reason);
    showDash();
    setTab("stats");
    closeExpForm(); // hidden by default
    await loadAll();
  })();

  // ---------- Login ----------
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (statusEl) statusEl.textContent = "Signing in…";

      const fd = new FormData(form);
      const email = String(fd.get("email") || "").trim();
      const password = String(fd.get("password") || "").trim();

      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        if (statusEl) statusEl.textContent = error.message || "Login failed.";
        return;
      }

      const gate = await enforceAdmin();
      if (!gate.ok) return showLogin(gate.reason);

      showDash();
      setTab("stats");
      closeExpForm();
      await loadAll();
      if (statusEl) statusEl.textContent = "";
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await sb.auth.signOut();
      showLogin("Logged out.");
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      const gate = await enforceAdmin();
      if (!gate.ok) return showLogin(gate.reason);
      await loadAll();
    });
  }

  // ---------- Experiments UI ----------
  if (newExpBtn) {
    newExpBtn.addEventListener("click", () => {
      resetExpForm();
      openExpForm("new");
      setTab("experiments");
    });
  }

  if (expCancelBtn) expCancelBtn.addEventListener("click", () => closeExpForm());

  if (expForm) {
    expForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (expStatusText) expStatusText.textContent = "Saving…";
      if (expSaveBtn) expSaveBtn.disabled = true;

      const payload = {
        title: expTitle ? expTitle.value.trim() : "",
        status: expStatus ? expStatus.value : "Upcoming",
        summary: expSummary ? expSummary.value.trim() : "",
        location: expLocation ? expLocation.value.trim() || null : null,
        sort_order: Number(expSort ? expSort.value || 100 : 100),
        is_published: !!(expPublished && expPublished.checked),
        updated_at: new Date().toISOString(),
      };

      try {
        if (expId && expId.value) {
          const id = Number(expId.value);
          const { error } = await sb.from("experiments").update(payload).eq("id", id);
          if (error) throw error;
        } else {
          const { error } = await sb.from("experiments").insert([{ ...payload }]);
          if (error) throw error;
        }
        if (expStatusText) expStatusText.textContent = "Saved.";
        await loadExperiments();
      } catch (err) {
        if (expStatusText) expStatusText.textContent = `Error: ${err?.message || "could not save"}`;
      } finally {
        if (expSaveBtn) expSaveBtn.disabled = false;
      }
    });
  }

  if (expDeleteBtn) {
    expDeleteBtn.addEventListener("click", async () => {
      if (!expId || !expId.value) return;
      const ok = confirm("Delete this experiment permanently?");
      if (!ok) return;

      const id = Number(expId.value);
      const { error } = await sb.from("experiments").delete().eq("id", id);
      if (error) {
        if (expStatusText) expStatusText.textContent = `Error: ${error.message}`;
        return;
      }
      closeExpForm();
      await loadExperiments();
    });
  }
});
