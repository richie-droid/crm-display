function fmtWeek(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, d)));
}

function fmtValue(value, format) {
  if (value === null || value === undefined) return "—";
  if (format === "money") return "$" + Math.round(Number(value)).toLocaleString("en-US");
  if (format === "money2") {
    return "$" + Number(value).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  return Number(value).toLocaleString("en-US");
}

function renderScorecardPage(data) {
  const { weeks, metrics, generatedAt } = data;

  const weekHeaders = weeks
    .map((w, i) => {
      const tag = i === weeks.length - 1 ? "Current Week" : `${weeks.length - 1 - i} Wk Ago`;
      return `<th class="wk"><span class="wk-tag">${tag}</span><span class="wk-date">${fmtWeek(w)}</span></th>`;
    })
    .join("");

  // Group metrics by section, preserving order of first appearance.
  const sections = [];
  const sectionIndex = new Map();
  for (const metric of metrics) {
    if (!sectionIndex.has(metric.section)) {
      sectionIndex.set(metric.section, sections.length);
      sections.push({ name: metric.section, rows: [] });
    }
    sections[sectionIndex.get(metric.section)].rows.push(metric);
  }

  const body = sections
    .map((section) => {
      const header = `<tr class="section-row"><td class="metric-cell">${section.name}</td>${weeks
        .map(() => "<td></td>")
        .join("")}</tr>`;
      const rows = section.rows
        .map((metric) => {
          const cells = metric.values
            .map((v) => `<td class="val">${fmtValue(v, metric.format)}</td>`)
            .join("");
          return `<tr><td class="metric-cell">${metric.label}</td>${cells}</tr>`;
        })
        .join("");
      return header + rows;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="900" />
  <title>Trinity Weekly Scorecard</title>
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
      --spring: #BFDBBB;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font-family: Arial, Helvetica, sans-serif; }
    .page { padding: 26px; max-width: 1000px; }
    h1 { margin: 0 0 4px; font-size: 28px; }
    .subtitle { color: var(--muted); font-size: 14px; margin-bottom: 18px; }
    table { border-collapse: separate; border-spacing: 0; width: 100%; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--panel); }
    th, td { border-bottom: 1px solid var(--line); padding: 12px 14px; text-align: right; }
    th.metric-head, td.metric-cell { text-align: left; }
    thead th { background: #24313d; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .04em; vertical-align: bottom; }
    th.wk { white-space: nowrap; }
    .wk-tag { display: block; font-size: 10px; opacity: .7; }
    .wk-date { display: block; font-size: 14px; color: var(--text); font-weight: 700; }
    .metric-cell { font-weight: 600; }
    tr.section-row td { background: var(--panel-2); color: var(--spring); font-size: 12px; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; }
    td.val { font-variant-numeric: tabular-nums; font-size: 17px; }
    tbody tr:last-child td { border-bottom: none; }
    .footer { margin-top: 12px; color: var(--muted); font-size: 12px; }
  </style>
</head>
<body>
  <main class="page">
    <h1>Weekly Scorecard</h1>
    <div class="subtitle">Current week and the previous four, rebuilt live from Salesforce. Columns are dated by each week's Monday.</div>
    <table>
      <thead>
        <tr>
          <th class="metric-head">Metric</th>
          ${weekHeaders}
        </tr>
      </thead>
      <tbody>
        ${body}
      </tbody>
    </table>
    <div class="footer">Generated ${new Date(generatedAt).toLocaleString("en-US")}. More metrics added one at a time.</div>
  </main>
</body>
</html>`;
}

module.exports = {
  renderScorecardPage,
};
