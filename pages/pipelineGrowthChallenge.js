function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderPipelineGrowthChallengePage(data) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(data.title)}</title>
  <style>
    body { margin: 0; padding: 32px; background: #111827; color: #f9fafb; font-family: Arial, sans-serif; }
    h1 { margin: 0 0 8px; }
    p { color: #cbd5e1; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; background: #1f2937; }
    th, td { padding: 14px 16px; border-bottom: 1px solid #374151; text-align: right; }
    th:first-child, td:first-child, th:nth-child(2), td:nth-child(2) { text-align: left; }
    th { color: #9ca3af; font-size: 13px; text-transform: uppercase; }
  </style>
</head>
<body>
  <h1>${escapeHtml(data.title)}</h1>
  <p>Data validation view. Final scoreboard design will follow after reconciliation.</p>
  <p>Live comparison: ${escapeHtml(data.windows.period1Equal.start)} through ${escapeHtml(data.windows.period1Equal.end || "Not started")} vs. ${escapeHtml(data.windows.period2Live.start)} through ${escapeHtml(data.windows.period2Live.end || "Not started")}.</p>
  <table>
    <thead><tr><th>Rank</th><th>Team</th><th>Period 1</th><th>Period 2</th><th>Growth</th></tr></thead>
    <tbody>
      ${data.teams.map((team) => `
        <tr>
          <td>${team.rank}</td>
          <td>${escapeHtml(team.team)}</td>
          <td>${team.period1Points.toLocaleString()}</td>
          <td>${team.period2Points.toLocaleString()}</td>
          <td>${team.growthPct === null ? "N/A" : `${team.growthPct.toFixed(1)}%`}</td>
        </tr>`).join("")}
    </tbody>
  </table>
</body>
</html>`;
}

module.exports = { renderPipelineGrowthChallengePage };
