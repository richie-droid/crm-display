function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateRange(window) {
  if (!window?.start || !window?.end) return "Not started";
  return `${window.start} through ${window.end}`;
}

function sumCounts(rows, bucket, category) {
  return rows.reduce(
    (total, agent) => total + Number(agent?.[bucket]?.[category] || 0),
    0
  );
}

function renderCountCells(agent, bucket) {
  const counts = agent[bucket] || {};

  return [
    "calls",
    "proposals",
    "listings",
    "lois",
    "contracts",
  ]
    .map((category) => `<td>${Number(counts[category] || 0).toLocaleString()}</td>`)
    .join("");
}

function renderPipelineGrowthChallengePage(data) {
  const agents = (data.teams || [])
    .flatMap((team) => team.agents || [])
    .sort(
      (a, b) =>
        String(a.team || "").localeCompare(String(b.team || "")) ||
        String(a.displayName || a.salesforceName || "").localeCompare(
          String(b.displayName || b.salesforceName || "")
        )
    );

  const categories = ["calls", "proposals", "listings", "lois", "contracts"];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(data.title)} - Data Verification</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #111827;
      --panel: #1f2937;
      --panel-2: #172033;
      --border: #374151;
      --text: #f9fafb;
      --muted: #9ca3af;
      --accent: #d1d5db;
      --p1: #263449;
      --p2: #213b32;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      padding: 28px;
      background: var(--bg);
      color: var(--text);
      font-family: Arial, Helvetica, sans-serif;
    }

    .page {
      max-width: 1900px;
      margin: 0 auto;
    }

    h1 {
      margin: 0;
      font-size: 32px;
      line-height: 1.1;
    }

    .subtitle {
      margin: 8px 0 0;
      color: var(--muted);
      font-size: 15px;
    }

    .periods {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin: 20px 0;
    }

    .period-card {
      min-width: 310px;
      padding: 12px 16px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--panel);
    }

    .period-label {
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .period-value {
      margin-top: 5px;
      font-size: 16px;
      font-weight: 700;
    }

    .table-wrap {
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--panel);
    }

    table {
      width: 100%;
      min-width: 1450px;
      border-collapse: collapse;
    }

    th,
    td {
      padding: 11px 12px;
      border-right: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    th:last-child,
    td:last-child { border-right: 0; }

    thead th {
      position: sticky;
      top: 0;
      z-index: 2;
      background: var(--panel-2);
      color: var(--accent);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    thead tr:first-child th {
      font-size: 13px;
      text-align: center;
    }

    th.identity,
    td.identity {
      text-align: left;
    }

    th.period1,
    td.period1 { background: var(--p1); }

    th.period2,
    td.period2 { background: var(--p2); }

    tbody tr:hover td { filter: brightness(1.12); }

    tbody tr:last-child td { border-bottom: 0; }

    .team-start td {
      border-top: 3px solid #6b7280;
    }

    tfoot td {
      background: #0f172a;
      font-weight: 700;
      border-top: 3px solid #9ca3af;
      border-bottom: 0;
    }

    .note {
      margin: 14px 0 0;
      color: var(--muted);
      font-size: 13px;
    }
  </style>
</head>
<body>
  <main class="page">
    <h1>${escapeHtml(data.title)} — Data Verification</h1>
    <p class="subtitle">Raw CRM record counts by agent. No points or growth calculations are shown here.</p>

    <section class="periods">
      <div class="period-card">
        <div class="period-label">Period 1 Full</div>
        <div class="period-value">${escapeHtml(formatDateRange(data.windows.period1Full))}</div>
      </div>
      <div class="period-card">
        <div class="period-label">Period 2 To Date</div>
        <div class="period-value">${escapeHtml(formatDateRange(data.windows.period2Live))}</div>
      </div>
      <div class="period-card">
        <div class="period-label">Generated</div>
        <div class="period-value">${escapeHtml(new Date(data.generatedAt).toLocaleString())}</div>
      </div>
    </section>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="identity" rowspan="2">Team</th>
            <th class="identity" rowspan="2">Agent</th>
            <th class="period1" colspan="5">Period 1 Full</th>
            <th class="period2" colspan="5">Period 2 To Date</th>
          </tr>
          <tr>
            <th class="period1">Calls</th>
            <th class="period1">Proposals</th>
            <th class="period1">Listings</th>
            <th class="period1">LOIs</th>
            <th class="period1">Contracts</th>
            <th class="period2">Calls</th>
            <th class="period2">Proposals</th>
            <th class="period2">Listings</th>
            <th class="period2">LOIs</th>
            <th class="period2">Contracts</th>
          </tr>
        </thead>
        <tbody>
          ${agents
            .map((agent, index) => {
              const priorTeam = index > 0 ? agents[index - 1].team : null;
              const rowClass = priorTeam !== agent.team ? "team-start" : "";

              return `<tr class="${rowClass}">
                <td class="identity">${escapeHtml(agent.team)}</td>
                <td class="identity">${escapeHtml(agent.displayName || agent.salesforceName)}</td>
                ${renderCountCells(agent, "period1Full")}
                ${renderCountCells(agent, "period2")}
              </tr>`;
            })
            .join("")}
        </tbody>
        <tfoot>
          <tr>
            <td class="identity" colspan="2">All Agents</td>
            ${categories
              .map((category) => `<td>${sumCounts(agents, "period1Full", category).toLocaleString()}</td>`)
              .join("")}
            ${categories
              .map((category) => `<td>${sumCounts(agents, "period2", category).toLocaleString()}</td>`)
              .join("")}
          </tr>
        </tfoot>
      </table>
    </div>

    <p class="note">Calls remain zero until weekly entries are added to config/pipeline-growth-calls.csv.</p>
  </main>
</body>
</html>`;
}

module.exports = { renderPipelineGrowthChallengePage };
