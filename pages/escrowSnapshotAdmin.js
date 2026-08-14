function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatCurrency(value) {
  return "$" + Math.round(Number(value || 0)).toLocaleString("en-US");
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function renderEscrowSnapshotAdminPage({ snapshotsData, current }) {
  const entries = snapshotsData?.entries || [];
  const live = current || { deals: 0, gci: 0, volume: 0, contractCount: 0 };
  const todayIso = new Date().toISOString().slice(0, 10);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Deals In Escrow - Weekly Snapshots</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0f1720;
      --panel: #17212b;
      --panel-2: #1d2a35;
      --line: #344454;
      --text: #f4f7f9;
      --muted: #aebbc6;
      --accent: #4E92C7;
      --success: #49b47a;
      --danger: #e06b6b;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font-family: Arial, Helvetica, sans-serif; }
    .page { padding: 24px; max-width: 1100px; }
    h1 { margin: 0 0 6px; font-size: 28px; }
    .subtitle, .updated { color: var(--muted); font-size: 14px; }
    .updated { margin-top: 4px; }
    .status { min-height: 20px; margin: 12px 0 4px; color: var(--muted); font-size: 14px; }
    .status.success { color: var(--success); }
    .status.error { color: var(--danger); }

    .layout { display: grid; grid-template-columns: 340px 1fr; gap: 22px; align-items: start; margin-top: 14px; }
    .panel { border: 1px solid var(--line); border-radius: 12px; background: var(--panel); }
    .panel-head { padding: 14px 18px; border-bottom: 1px solid var(--line); font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); display: flex; justify-content: space-between; align-items: baseline; }
    .panel-head .count { color: var(--text); font-weight: 700; }

    /* Left: add / edit form */
    .add-panel { position: sticky; top: 24px; }
    .form-body { padding: 16px 18px 18px; }
    .field { margin-bottom: 14px; }
    .field label { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin-bottom: 6px; }
    .field input { width: 100%; border: 1px solid var(--line); border-radius: 6px; background: #0f1820; color: var(--text); font: inherit; padding: 10px 10px; }
    .field input:hover, .field input:focus { border-color: var(--accent); outline: none; }
    .form-actions { display: flex; gap: 10px; margin-top: 4px; }
    button { border: 0; border-radius: 7px; background: var(--accent); color: #06121b; cursor: pointer; font-weight: 700; padding: 11px 16px; font: inherit; }
    button.secondary { background: var(--panel-2); color: var(--text); border: 1px solid var(--line); font-weight: 600; }
    button:disabled { opacity: .55; cursor: wait; }
    .form-actions button { flex: 1; }

    .live { margin: 4px 18px 16px; border: 1px dashed var(--line); border-radius: 9px; padding: 12px 14px; }
    .live-title { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-bottom: 8px; }
    .live-stats { display: flex; gap: 18px; flex-wrap: wrap; margin-bottom: 10px; }
    .live-stat b { font-size: 18px; display: block; }
    .live-stat span { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .03em; }
    .live button { width: 100%; }
    .edit-banner { display: none; margin: 0 18px 12px; padding: 9px 12px; border-radius: 8px; background: rgba(78,146,199,.16); border: 1px solid var(--accent); color: var(--text); font-size: 13px; }
    .edit-banner.active { display: block; }

    /* Right: existing snapshots grouped by month/year */
    .list-body { padding: 8px 0 10px; max-height: calc(100vh - 220px); overflow: auto; }
    .month-header { position: sticky; top: 0; background: #24313d; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .05em; padding: 9px 18px; border-bottom: 1px solid var(--line); z-index: 2; }
    .month-header .m-count { float: right; text-transform: none; letter-spacing: 0; }
    .snap-row { display: grid; grid-template-columns: 96px 1fr 1fr auto; align-items: center; gap: 12px; padding: 11px 18px; border-bottom: 1px solid rgba(52,68,84,.55); }
    .snap-row:hover { background: var(--panel-2); }
    .snap-date { font-weight: 700; }
    .snap-metric b { font-size: 17px; }
    .snap-metric span { color: var(--muted); font-size: 11px; margin-left: 5px; text-transform: uppercase; }
    .snap-actions { display: flex; gap: 4px; }
    button.link { background: transparent; border: 0; padding: 6px 8px; font-weight: 600; font-size: 13px; }
    button.link.edit-btn { color: var(--accent); }
    button.link.remove-btn { color: var(--danger); }
    .empty { padding: 28px 18px; color: var(--muted); text-align: center; }

    .legend { margin-top: 14px; color: var(--muted); font-size: 12px; line-height: 1.5; max-width: 760px; }
    @media (max-width: 820px) {
      .layout { grid-template-columns: 1fr; }
      .add-panel { position: static; }
      .list-body { max-height: none; }
    }
  </style>
</head>
<body>
  <main class="page">
    <h1>Deals In Escrow — Weekly Snapshots</h1>
    <div class="subtitle">Manual weekly history. GCI is Trinity contract commission (projected). Volume was never tracked, so it is not entered here.</div>
    <div class="updated">Last saved: <span id="updatedAt">${escapeHtml(snapshotsData?.updatedAt || "Never")}</span></div>
    <div id="status" class="status"></div>

    <div class="layout">
      <!-- LEFT: add / edit -->
      <section class="panel add-panel">
        <div class="panel-head"><span id="formTitle">Add New Snapshot</span></div>

        <div class="live">
          <div class="live-title">Current live escrow (from Contracts)</div>
          <div class="live-stats">
            <div class="live-stat"><b>${escapeHtml(live.deals)}</b><span>Deals</span></div>
            <div class="live-stat"><b>${escapeHtml(formatCurrency(live.volume))}</b><span>Volume</span></div>
            <div class="live-stat"><b>${escapeHtml(round2(live.gci))}</b><span>GCI $</span></div>
          </div>
          <button type="button" class="secondary" id="useLiveBtn">Fill form with current live numbers</button>
        </div>

        <div class="edit-banner" id="editBanner"></div>

        <div class="form-body">
          <div class="field">
            <label for="fDate">Week Ending</label>
            <input type="date" id="fDate" />
          </div>
          <div class="field">
            <label for="fDeals">Deals in Escrow</label>
            <input type="number" id="fDeals" min="0" step="1" inputmode="numeric" placeholder="e.g. 55" />
          </div>
          <div class="field">
            <label for="fGci">Escrow GCI ($)</label>
            <input type="number" id="fGci" min="0" step="0.01" inputmode="decimal" placeholder="e.g. 2500000" />
          </div>
          <div class="form-actions">
            <button type="button" id="saveBtn">Save Snapshot</button>
            <button type="button" class="secondary" id="clearBtn">Clear</button>
          </div>
        </div>
      </section>

      <!-- RIGHT: existing snapshots -->
      <section class="panel">
        <div class="panel-head"><span>Existing Snapshots</span><span class="count" id="count">0</span></div>
        <div class="list-body" id="list"></div>
      </section>
    </div>

    <div class="legend">
      One row per week. The TV dashboard compares the current live numbers to the snapshot nearest 52 weeks ago.
      Saving a date that already exists overwrites that week. Every add, edit, and remove saves immediately.
    </div>
  </main>

  <script>
    const TODAY = ${JSON.stringify(todayIso)};
    const LIVE = { deals: ${Number(live.deals) || 0}, gci: ${Number(live.gci) || 0} };
    let entries = ${JSON.stringify(entries)};
    let editingOriginal = null;

    const statusEl = document.getElementById("status");
    const updatedAtEl = document.getElementById("updatedAt");
    const listEl = document.getElementById("list");
    const countEl = document.getElementById("count");
    const fDate = document.getElementById("fDate");
    const fDeals = document.getElementById("fDeals");
    const fGci = document.getElementById("fGci");
    const saveBtn = document.getElementById("saveBtn");
    const formTitle = document.getElementById("formTitle");
    const editBanner = document.getElementById("editBanner");

    function setStatus(message, type = "") {
      statusEl.textContent = message;
      statusEl.className = "status " + type;
    }

    function fmtMonth(ym) {
      const [y, m] = ym.split("-").map(Number);
      return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
        .format(new Date(Date.UTC(y, m - 1, 1)));
    }
    function fmtDay(iso) {
      const [y, m, d] = iso.split("-").map(Number);
      return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
        .format(new Date(Date.UTC(y, m - 1, d)));
    }
    function fmtMoney(n) { return "$" + Math.round(Number(n || 0)).toLocaleString("en-US"); }

    function renderList() {
      const sorted = entries.slice().sort((a, b) => b.weekEnding.localeCompare(a.weekEnding));
      countEl.textContent = sorted.length;

      if (!sorted.length) {
        listEl.innerHTML = '<div class="empty">No snapshots yet. Add your first one on the left.</div>';
        return;
      }

      const groups = new Map();
      for (const e of sorted) {
        const ym = e.weekEnding.slice(0, 7);
        if (!groups.has(ym)) groups.set(ym, []);
        groups.get(ym).push(e);
      }

      let html = "";
      for (const [ym, rows] of groups) {
        html += '<div class="month-header">' + fmtMonth(ym) +
          '<span class="m-count">' + rows.length + (rows.length === 1 ? " week" : " weeks") + '</span></div>';
        for (const e of rows) {
          html +=
            '<div class="snap-row">' +
              '<div class="snap-date">' + fmtDay(e.weekEnding) + '</div>' +
              '<div class="snap-metric"><b>' + Number(e.deals).toLocaleString("en-US") + '</b><span>deals</span></div>' +
              '<div class="snap-metric"><b>' + fmtMoney(e.gci) + '</b><span>gci</span></div>' +
              '<div class="snap-actions">' +
                '<button type="button" class="link edit-btn" data-week="' + e.weekEnding + '">Edit</button>' +
                '<button type="button" class="link remove-btn" data-week="' + e.weekEnding + '">Remove</button>' +
              '</div>' +
            '</div>';
        }
      }
      listEl.innerHTML = html;
    }

    async function persist(newEntries) {
      const res = await fetch("/api/escrow-snapshot/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: newEntries }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Save failed");
      entries = result.entries;
      updatedAtEl.textContent = result.updatedAt;
      renderList();
      return result;
    }

    function exitEditMode() {
      editingOriginal = null;
      formTitle.textContent = "Add New Snapshot";
      editBanner.className = "edit-banner";
      editBanner.textContent = "";
    }

    function clearForm() {
      fDate.value = "";
      fDeals.value = "";
      fGci.value = "";
      exitEditMode();
    }

    document.getElementById("useLiveBtn").addEventListener("click", () => {
      fDate.value = TODAY;
      fDeals.value = LIVE.deals;
      fGci.value = LIVE.gci;
      setStatus("Filled the form with the current live numbers. Review the week-ending date, then Save.", "");
      fDate.focus();
    });

    document.getElementById("clearBtn").addEventListener("click", () => {
      clearForm();
      setStatus("");
    });

    saveBtn.addEventListener("click", async () => {
      const date = fDate.value.trim();
      const dealsRaw = fDeals.value.trim();
      const gciRaw = fGci.value.trim();

      if (!date) { setStatus("Pick a week-ending date.", "error"); return; }
      if (dealsRaw === "" && gciRaw === "") { setStatus("Enter deals and/or GCI.", "error"); return; }

      const deals = dealsRaw === "" ? 0 : Number(dealsRaw);
      const gci = gciRaw === "" ? 0 : Number(gciRaw);
      if (!Number.isInteger(deals) || deals < 0) { setStatus("Deals must be a whole number.", "error"); return; }
      if (!Number.isFinite(gci) || gci < 0) { setStatus("GCI must be a non-negative number.", "error"); return; }

      // Upsert: drop any entry on the target date (and the original date if editing), then add.
      const working = entries.filter(
        (e) => e.weekEnding !== date && e.weekEnding !== editingOriginal
      );
      working.push({ weekEnding: date, deals, gci });

      saveBtn.disabled = true;
      setStatus("Saving...");
      try {
        const wasEditing = editingOriginal !== null;
        await persist(working);
        clearForm();
        setStatus(wasEditing ? "Updated the snapshot." : "Added the snapshot.", "success");
      } catch (error) {
        setStatus(error.message, "error");
      } finally {
        saveBtn.disabled = false;
      }
    });

    listEl.addEventListener("click", async (event) => {
      const week = event.target.dataset.week;
      if (!week) return;

      if (event.target.classList.contains("edit-btn")) {
        const entry = entries.find((e) => e.weekEnding === week);
        if (!entry) return;
        fDate.value = entry.weekEnding;
        fDeals.value = entry.deals;
        fGci.value = entry.gci;
        editingOriginal = entry.weekEnding;
        formTitle.textContent = "Edit Snapshot";
        editBanner.className = "edit-banner active";
        editBanner.textContent = "Editing week of " + fmtDay(entry.weekEnding) + ". Change the date to move it to a different week.";
        setStatus("");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      if (event.target.classList.contains("remove-btn")) {
        if (!confirm("Remove the snapshot for week of " + fmtDay(week) + "?")) return;
        try {
          await persist(entries.filter((e) => e.weekEnding !== week));
          if (editingOriginal === week) clearForm();
          setStatus("Removed the snapshot.", "success");
        } catch (error) {
          setStatus(error.message, "error");
        }
      }
    });

    renderList();
  </script>
</body>
</html>`;
}

module.exports = { renderEscrowSnapshotAdminPage };
