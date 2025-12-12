document.addEventListener("DOMContentLoaded", () => {
  const ADMIN_EMAIL = "projectaarna@protonmail.com";
  const sb = window.sb;

  // Theme
  const root = document.documentElement;
  const themeToggle = document.getElementById("theme-toggle");
  const THEME_KEY = "aarna-theme";
  root.setAttribute("data-theme", localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark");
  themeToggle?.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    localStorage.setItem(THEME_KEY, next);
    root.setAttribute("data-theme", next);
    const icon = themeToggle.querySelector(".theme-icon");
    if (icon) icon.textContent = next === "light" ? "☀︎" : "☾";
  });

  const authCard = document.getElementById("auth-card");
  const dash = document.getElementById("dashboard");
  const form = document.getElementById("admin-login-form");
  const statusEl = document.getElementById("login-status");
  const logoutBtn = document.getElementById("logout-btn");
  const refreshBtn = document.getElementById("refresh-btn");

  const statNew = document.getElementById("stat-new");
  const statContacted = document.getElementById("stat-contacted");
  const statClosed = document.getElementById("stat-closed");
  const statSubs = document.getElementById("stat-subs");

  const tbodyNew = document.getElementById("contacts-new-tbody");
  const tbodyContacted = document.getElementById("contacts-contacted-tbody");
  const tbodyClosed = document.getElementById("contacts-closed-tbody");
  const subsTbody = document.getElementById("subs-tbody");

  const esc = (s) =>
    String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");

  const showLogin = (msg = "") => {
    authCard.style.display = "block";
    dash.style.display = "none";
    statusEl.textContent = msg;
  };

  const showDash = () => {
    authCard.style.display = "none";
    dash.style.display = "block";
  };

  async function enforceAdmin() {
    if (!sb) return { ok: false, reason: "Supabase not initialized. Check /admin script paths." };

    const { data: userRes, error: userErr } = await sb.auth.getUser();
    if (userErr) return { ok: false, reason: `Auth error: ${userErr.message}` };

    const user = userRes?.user;
    if (!user) return { ok: false, reason: "" };

    if ((user.email || "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      await sb.auth.signOut();
      return { ok: false, reason: "Access denied (admin email only)." };
    }

    const { data: prof, error } = await sb
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (error) return { ok: false, reason: `profiles table/policy error: ${error.message}` };
    if (!prof) return { ok: false, reason: "Admin profile missing. Run the SQL admin upsert." };
    if (prof.role !== "admin") return { ok: false, reason: "Role is not admin. Set role='admin'." };

    return { ok: true };
  }

  function attachStatusHandlers(tbody) {
    tbody.querySelectorAll(".status-select").forEach((sel) => {
      sel.addEventListener("change", async (e) => {
        const id = Number(e.target.getAttribute("data-id"));
        const status = e.target.value;
        const { error } = await sb.from("contacts").update({ status }).eq("id", id);
        if (error) console.error("[AARNA] status update error:", error);
        await loadDashboard();
      });
    });
  }

  function renderContacts(tbody, rows) {
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

  async function loadDashboard() {
    const [newRes, contactedRes, closedRes, subsRes] = await Promise.all([
      sb.from("contacts").select("id,name,email,message,created_at,status").eq("status", "new").order("created_at", { ascending: false }).limit(120),
      sb.from("contacts").select("id,name,email,message,created_at,status").eq("status", "contacted").order("created_at", { ascending: false }).limit(120),
      sb.from("contacts").select("id,name,email,message,created_at,status").eq("status", "closed").order("created_at", { ascending: false }).limit(200),
      sb.from("newsletter_subscribers").select("email,created_at").order("created_at", { ascending: false }).limit(500),
    ]);

    if (newRes.error) console.error(newRes.error);
    if (contactedRes.error) console.error(contactedRes.error);
    if (closedRes.error) console.error(closedRes.error);
    if (subsRes.error) console.error(subsRes.error);

    const newRows = newRes.data || [];
    const contactedRows = contactedRes.data || [];
    const closedRows = closedRes.data || [];
    const subs = subsRes.data || [];

    statNew.textContent = String(newRows.length);
    statContacted.textContent = String(contactedRows.length);
    statClosed.textContent = String(closedRows.length);
    statSubs.textContent = String(subs.length);

    renderContacts(tbodyNew, newRows);
    renderContacts(tbodyContacted, contactedRows);
    renderContacts(tbodyClosed, closedRows);

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

  (async () => {
    const gate = await enforceAdmin();
    if (!gate.ok) return showLogin(gate.reason);
    showDash();
    await loadDashboard();
  })();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    statusEl.textContent = "Signing in…";

    const fd = new FormData(form);
    const email = String(fd.get("email") || "").trim();
    const password = String(fd.get("password") || "").trim();

    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      statusEl.textContent = error.message || "Login failed.";
      return;
    }

    const gate = await enforceAdmin();
    if (!gate.ok) return showLogin(gate.reason);

    showDash();
    await loadDashboard();
    statusEl.textContent = "";
  });

  logoutBtn.addEventListener("click", async () => {
    await sb.auth.signOut();
    showLogin("Logged out.");
  });

  refreshBtn.addEventListener("click", async () => {
    const gate = await enforceAdmin();
    if (!gate.ok) return showLogin(gate.reason);
    await loadDashboard();
  });
});
