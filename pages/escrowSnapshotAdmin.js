function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderRow(entry) {
  const weekEnding = entry ? entry.weekEnding : "";
  const deals = entry ? entry.deals : "";
  const gci = entry ? entry.gci : "";

  return `<tr class="snapshot-row">
    <td><input class="date-input" type="date" value="${escapeHtml(weekEnding)}" aria-label="Week ending date" /></td>
    <td><input class="deals-input" type="number" min="0" step="1" inputmode="numeric" value="${escapeHtml(deals)}" aria-label="Deals in escrow" /></td>
    <td><input class="gci-input" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeHtml(gci)}" aria-label="Escrow GCI" /></td>
    <td class="remove-cell"><button type="button" class="remove-btn" title="Remove row">✕</button></td>
  </tr>`;
}

function renderEscrowSnapshotAdminPage({ snapshotsData, current }) {
  const entries = snapshotsData?.entries || [];
  const rows = entries.length
    ? entries.map((entry) => renderRow(entry)).join("")
    : renderRow(null);

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
    .page { padding: 24px; max-width: 760px; }
    h1 { margin: 0 0 6px; font-size: 30px; }
    .subtitle, .updated { color: var(--muted); font-size: 14px; }
    .live {
      margin: 16px 0 18px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--panel);
      padding: 14px 16px;
    }
    .live-title { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin-bottom: 8px; }
    .live-stats { display: flex; gap: 26px; flex-wrap: wrap; align-items: center; }
    .live-stat b { font-size: 22px; }
    .live-stat span { color: var(--muted); font-size: 12px; display: block; text-transform: uppercase; letter-spacing: .04em; }
    .actions { display: flex; align-items: center; gap: 10px; margin: 8px 0 4px; flex-wrap: wrap; }
    button {
      border: 0; border-radius: 7px; background: var(--accent); color: #06121b;
      cursor: pointer; font-weight: 700; padding: 11px 16px;
    }
    button.secondary { background: var(--panel-2); color: var(--text); border: 1px solid var(--line); }
    button:disabled { opacity: .55; cursor: wait; }
    .status { min-height: 20px; margin: 10px 0; color: var(--muted); }
    .status.success { color: var(--success); }
    .status.error { color: var(--danger); }
    table { border-collapse: separate; border-spacing: 0; width: 100%; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: var(--panel); }
    th, td { border-bottom: 1px solid var(--line); padding: 8px 10px; text-align: left; }
    th { background: #24313d; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
    tbody tr:nth-child(even) td { background: var(--panel-2); }
    tbody tr:last-child td { border-bottom: none; }
    input { border: 1px solid transparent; border-radius: 5px; background: #0f1820; color: var(--text); font: inherit; padding: 9px 8px; }
    input:hover, input:focus { border-color: var(--accent); outline: none; }
    .date-input { width: 170px; }
    .deals-input { width: 110px; text-align: center; }
    .gci-input { width: 150px; text-align: right; }
    .remove-cell { text-align: center; width: 44px; }
    .remove-btn { background: transparent; color: var(--danger); font-size: 16px; padding: 6px 8px; }
    .legend { margin-top: 10px; color: var(--muted); font-size: 12px; line-height: 1.5; }
  </style>
</head>
<body>
  <main class="page">
    <h1>Deals In Escrow — Weekly Snapshots</h1>
    <div class="subtitle">Manual weekly history. GCI is Trinity contract commission (projected). Volume was never tracked, so it is not entered here.</div>
    <div class="updated">Last saved: <span id="updatedAt">${escapeHtml(snapshotsData?.updatedAt || "Never")}</span></div>

    <div class="live">
      <div class="live-title">Current live escrow (from Contracts, right now)</div>
      <div class="live-stats">
        <div class="live-stat"><b id="liveDeals">${escapeHtml(live.deals)}</b><span>Deals</span></div>
        <div class="live-stat"><b>${escapeHtml(formatCurrency(live.volume))}</b><span>Volume</span></div>
        <div class="live-stat"><b id="liveGci">${escapeHtml(round2(live.gci))}</b><span>GCI $</span></div>
        <button type="button" class="secondary" id="captureBtn">Add this week from live</button>
      </div>
    </div>

    <div class="actions">
      <button type="button" id="addRowBtn" class="secondary">Add blank row</button>
      <button type="button" id="saveBtn">Save Snapshots</button>
    </div>
    <div id="status" class="status"></div>

    <table>
      <thead>
        <tr>
          <th>Week Ending</th>
          <th>Deals</th>
          <th>GCI ($)</th>
          <th></th>
        </tr>
      </thead>
      <tbody id="rows">${rows}</tbody>
    </table>

    <div class="legend">
      One row per week. The TV dashboard compares the current live numbers to the snapshot nearest 52 weeks ago.
      Blank rows (no deals and no GCI) are dropped on save. Editing a date that already exists overwrites that week.
    </div>
  </main>

  <script>
    const TODAY = ${JSON.stringify(todayIso)};
    const LIVE = { deals: ${Number(live.deals) || 0}, gci: ${Number(live.gci) || 0} };
    const rowsEl = document.getElementById("rows");
    const statusEl = document.getElementById("status");
    const updatedAtEl = document.getElementById("updatedAt");
    const saveBtn = document.getElementById("saveBtn");

    function setStatus(message, type = "") {
      statusEl.textContent = message;
      statusEl.className = "status " + type;
    }

    function rowTemplate(date, deals, gci) {
      const tr = document.createElement("tr");
      tr.className = "snapshot-row";
      tr.innerHTML =
        '<td><input class="date-input" type="date" aria-label="Week ending date" /></td>' +
        '<td><input class="deals-input" type="number" min="0" step="1" inputmode="numeric" aria-label="Deals in escrow" /></td>' +
        '<td><input class="gci-input" type="number" min="0" step="0.01" inputmode="decimal" aria-label="Escrow GCI" /></td>' +
        '<td class="remove-cell"><button type="button" class="remove-btn" title="Remove row">\\u2715</button></td>';
      tr.querySelector(".date-input").value = date || "";
      tr.querySelector(".deals-input").value = (deals ?? "") === "" ? "" : deals;
      tr.querySelector(".gci-input").value = (gci ?? "") === "" ? "" : gci;
      return tr;
    }

    rowsEl.addEventListener("click", (event) => {
      if (event.target.classList.contains("remove-btn")) {
        event.target.closest("tr").remove();
      }
    });

    document.getElementById("addRowBtn").addEventListener("click", () => {
      rowsEl.appendChild(rowTemplate("", "", ""));
    });

    document.getElementById("captureBtn").addEventListener("click", () => {
      rowsEl.insertBefore(rowTemplate(TODAY, LIVE.deals, LIVE.gci), rowsEl.firstChild);
      setStatus("Added a row from the current live numbers. Review the date, then Save.", "");
    });

    saveBtn.addEventListener("click", async () => {
      const entries = [...document.querySelectorAll(".snapshot-row")]
        .map((row) => ({
          weekEnding: row.querySelector(".date-input").value.trim(),
          deals: row.querySelector(".deals-input").value.trim(),
          gci: row.querySelector(".gci-input").value.trim(),
        }))
        .filter((e) => e.weekEnding || e.deals || e.gci);

      const badDate = entries.find((e) => !/^\\d{4}-\\d{2}-\\d{2}$/.test(e.weekEnding));
      if (badDate) { setStatus("Every row needs a valid week-ending date.", "error"); return; }

      saveBtn.disabled = true;
      setStatus("Saving...");
      try {
        const res = await fetch("/api/escrow-snapshot/snapshots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.message || "Save failed");
        updatedAtEl.textContent = result.updatedAt;
        setStatus("Saved " + result.entries.length + " weekly snapshots. The dashboard will use them immediately.", "success");
      } catch (error) {
        setStatus(error.message, "error");
      } finally {
        saveBtn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

function formatCurrency(value) {
  return "$" + Math.round(Number(value || 0)).toLocaleString("en-US");
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

module.exports = { renderEscrowSnapshotAdminPage };
