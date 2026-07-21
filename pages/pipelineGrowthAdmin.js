function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function dateLabel(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function renderPipelineGrowthAdminPage({ roster, weeks, callsData }) {
  const valueMap = new Map(
    callsData.entries.map((entry) => [
      `${entry.weekStart}|${entry.salesforceName.toLowerCase()}`,
      entry.calls,
    ])
  );

  const period1Weeks = weeks.filter((week) => week.period === 1);
  const period2Weeks = weeks.filter((week) => week.period === 2);

  const headerCells = weeks
    .map(
      (week) =>
        `<th class="week period-${week.period}" title="Week of ${escapeHtml(week.weekStart)}">${dateLabel(week.weekStart)}</th>`
    )
    .join("");

  const rows = roster
    .map((agent) => {
      const cells = weeks
        .map((week) => {
          const key = `${week.weekStart}|${agent.salesforceName.toLowerCase()}`;
          const value = valueMap.has(key) ? valueMap.get(key) : "";
          return `<td class="period-${week.period}">
            <input
              class="call-input"
              type="number"
              inputmode="numeric"
              min="0"
              step="1"
              value="${escapeHtml(value)}"
              data-week="${escapeHtml(week.weekStart)}"
              data-agent="${escapeHtml(agent.salesforceName)}"
              aria-label="${escapeHtml(agent.displayName)} calls for week of ${escapeHtml(week.weekStart)}"
            />
          </td>`;
        })
        .join("");

      return `<tr>
        <td class="team-cell">${escapeHtml(agent.team)}</td>
        <td class="agent-cell">
          <strong>${escapeHtml(agent.displayName)}</strong>
          <span>${escapeHtml(agent.salesforceName)}</span>
        </td>
        ${cells}
      </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pipeline Growth Challenge - Call Admin</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0f1720;
      --panel: #17212b;
      --panel-2: #1d2a35;
      --line: #344454;
      --text: #f4f7f9;
      --muted: #aebbc6;
      --accent: #d6a84b;
      --success: #49b47a;
      --danger: #e06b6b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: Arial, Helvetica, sans-serif;
    }
    .page { padding: 24px; }
    .header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 18px;
    }
    h1 { margin: 0 0 6px; font-size: 30px; }
    .subtitle, .updated { color: var(--muted); font-size: 14px; }
    .actions { display: flex; align-items: center; gap: 10px; }
    .password {
      width: 190px;
      border: 1px solid var(--line);
      border-radius: 7px;
      background: var(--panel);
      color: var(--text);
      padding: 11px 12px;
    }
    button {
      border: 0;
      border-radius: 7px;
      background: var(--accent);
      color: #17130a;
      cursor: pointer;
      font-weight: 700;
      padding: 12px 18px;
    }
    button:disabled { opacity: .55; cursor: wait; }
    .status { min-height: 20px; margin: 8px 0 12px; color: var(--muted); }
    .status.success { color: var(--success); }
    .status.error { color: var(--danger); }
    .table-wrap {
      overflow: auto;
      max-height: calc(100vh - 170px);
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--panel);
    }
    table { border-collapse: separate; border-spacing: 0; min-width: 1500px; width: 100%; }
    th, td { border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
    th {
      position: sticky;
      top: 0;
      z-index: 4;
      background: #24313d;
      color: var(--muted);
      font-size: 12px;
      letter-spacing: .04em;
      padding: 12px 8px;
      text-transform: uppercase;
      white-space: nowrap;
    }
    th.period-1 { background: #273744; }
    th.period-2 { background: #3a3424; color: #f2dfb4; }
    td { padding: 5px; text-align: center; background: var(--panel); }
    tbody tr:nth-child(even) td { background: var(--panel-2); }
    .team-head, .team-cell {
      position: sticky;
      left: 0;
      z-index: 3;
      width: 120px;
      min-width: 120px;
      text-align: left;
    }
    .agent-head, .agent-cell {
      position: sticky;
      left: 120px;
      z-index: 3;
      width: 190px;
      min-width: 190px;
      text-align: left;
      box-shadow: 2px 0 0 var(--line);
    }
    th.team-head, th.agent-head { z-index: 6; }
    .team-cell, .agent-cell { padding: 10px 12px; }
    .agent-cell strong { display: block; }
    .agent-cell span { display: block; margin-top: 2px; color: var(--muted); font-size: 11px; }
    .call-input {
      width: 72px;
      border: 1px solid transparent;
      border-radius: 5px;
      background: #0f1820;
      color: var(--text);
      font: inherit;
      padding: 9px 6px;
      text-align: center;
    }
    .call-input:hover, .call-input:focus {
      border-color: var(--accent);
      outline: none;
    }
    td.period-2 .call-input { background: #211e16; }
    .legend { margin-top: 7px; color: var(--muted); font-size: 12px; }
    @media (max-width: 900px) {
      .header { align-items: stretch; flex-direction: column; }
      .actions { flex-wrap: wrap; }
    }
  </style>
</head>
<body>
  <main class="page">
    <div class="header">
      <div>
        <h1>Pipeline Growth Challenge Calls</h1>
        <div class="subtitle">Edit any cell, then save the entire table. Blank cells are not counted.</div>
        <div class="updated">Last saved: <span id="updatedAt">${escapeHtml(callsData.updatedAt || "Never")}</span></div>
      </div>
      <div class="actions">
        <button id="saveButton" type="button">Save Calls</button>
      </div>
    </div>
    <div id="status" class="status"></div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="team-head">Team</th>
            <th class="agent-head">Agent</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="legend">Period 1: ${period1Weeks.length} weekly columns &nbsp;|&nbsp; Period 2: ${period2Weeks.length} weekly columns</div>
  </main>
  <script>
    const saveButton = document.getElementById("saveButton");
    const statusEl = document.getElementById("status");
    const updatedAtEl = document.getElementById("updatedAt");

    function setStatus(message, type = "") {
      statusEl.textContent = message;
      statusEl.className = "status " + type;
    }

    saveButton.addEventListener("click", async () => {
      const entries = [...document.querySelectorAll(".call-input")].map((input) => ({
        weekStart: input.dataset.week,
        salesforceName: input.dataset.agent,
        calls: input.value.trim() === "" ? null : Number(input.value),
      }));

      const invalid = entries.find(
        (entry) => entry.calls !== null && (!Number.isInteger(entry.calls) || entry.calls < 0)
      );
      if (invalid) {
        setStatus("Calls must be blank or a non-negative whole number.", "error");
        return;
      }

      saveButton.disabled = true;
      setStatus("Saving...");

      try {
        const response = await fetch("/api/pipeline-growth-challenge/calls", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ entries }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Save failed");

        updatedAtEl.textContent = result.updatedAt;
        setStatus("Saved " + result.entries.length + " call entries. The scoreboard will use them immediately.", "success");
      } catch (error) {
        setStatus(error.message, "error");
      } finally {
        saveButton.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

module.exports = { renderPipelineGrowthAdminPage };
