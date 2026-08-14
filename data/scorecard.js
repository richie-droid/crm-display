const { getSalesforceToken, querySalesforce } = require("../salesforce/client");
const { loadEscrowSnapshots } = require("../storage/escrowSnapshots");

// The scorecard's "Weekly" tab shows the current week plus the previous 4,
// each column dated with that week's Monday.
//
// Two column conventions live in the sheet, both reproduced here:
//   * Company Trends (cumulative / point-in-time): a column dated Monday W
//     reflects the "beginning of week" state, i.e. through the prior day (W-1).
//   * Weekly Activity Levels (per-week flows): a column dated Monday W counts
//     events during that week, [W, W+6] (Mon-Sun).

function getField(record, fieldName) {
  if (!record) return undefined;
  if (record[fieldName] !== undefined) return record[fieldName];
  const key = Object.keys(record).find(
    (candidate) => candidate.toLowerCase() === fieldName.toLowerCase()
  );
  return key ? record[key] : undefined;
}

function isoOf(date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addIsoDays(iso, days) {
  return isoOf(addUtcDays(new Date(`${iso}T00:00:00.000Z`), days));
}

function mondayOf(date) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = day.getUTCDay(); // 0=Sun .. 6=Sat
  const shift = dow === 0 ? -6 : 1 - dow;
  return addUtcDays(day, shift);
}

// Returns the 5 week-anchor Mondays [oldest ... current], matching the sheet.
function getWeeks(anchor = new Date()) {
  const currentMonday = mondayOf(anchor);
  const weeks = [];
  for (let i = 4; i >= 0; i -= 1) {
    weeks.push(isoOf(addUtcDays(currentMonday, -7 * i)));
  }
  return weeks;
}

function dateOf(record, fieldName) {
  return String(getField(record, fieldName) || "").slice(0, 10);
}

async function fetchByDateRange(instanceUrl, accessToken, dateField, startIso, endIso, extraFields = "") {
  const soql = `
    SELECT ${dateField}${extraFields ? `, ${extraFields}` : ""}
    FROM ContractNew__c
    WHERE ${dateField} >= ${startIso}
      AND ${dateField} <= ${endIso}
  `;
  const result = await querySalesforce(instanceUrl, accessToken, soql);
  return result.records || [];
}

// Cumulative count/GCI as of each week (events strictly before the week's Monday).
function cumulativeByWeek(records, dateField, gciField, weeks) {
  return weeks.map((week) => {
    let count = 0;
    let gci = 0;
    for (const record of records) {
      const d = dateOf(record, dateField);
      if (d && d < week) {
        count += 1;
        if (gciField) gci += Number(getField(record, gciField) || 0);
      }
    }
    return { count, gci: Math.round(gci * 100) / 100 };
  });
}

// Per-week flow count of events during [W, W+6].
function flowByWeek(records, dateField, weeks) {
  return weeks.map((week) => {
    const end = addIsoDays(week, 6);
    let count = 0;
    for (const record of records) {
      const d = dateOf(record, dateField);
      if (d && d >= week && d <= end) count += 1;
    }
    return count;
  });
}

function escrowByWeek(weeks) {
  const byDate = new Map(loadEscrowSnapshots().map((s) => [s.weekEnding, s]));
  return weeks.map((week) => {
    const snap = byDate.get(week);
    return snap
      ? { deals: snap.deals, gci: snap.gci }
      : { deals: null, gci: null };
  });
}

async function buildScorecard({ anchorDate } = {}) {
  const anchor = anchorDate ? new Date(`${String(anchorDate).slice(0, 10)}T00:00:00.000Z`) : new Date();
  const weeks = getWeeks(anchor);
  const year = Number(weeks[weeks.length - 1].slice(0, 4));
  const spanEnd = addIsoDays(weeks[weeks.length - 1], 6); // include the current week's Sun

  const token = await getSalesforceToken();
  const { instance_url: instanceUrl, access_token: accessToken } = token;

  const [closedRecords, newContractRecords] = await Promise.all([
    // Closed: whole YTD (for cumulative) through the current week's end (for flow).
    // GCI uses the contract-commission field (matches the sheet; actual runs ~2% low).
    fetchByDateRange(instanceUrl, accessToken, "actual_close_date__c", `${year}-01-01`, spanEnd, "Trinity_Contract_Commission_Dollars_form__c"),
    // New contracts: just the 5-week span, by effective date.
    fetchByDateRange(instanceUrl, accessToken, "Contract_Effective_Date__c", weeks[0], spanEnd),
  ]);

  const closedCum = cumulativeByWeek(closedRecords, "actual_close_date__c", "Trinity_Contract_Commission_Dollars_form__c", weeks);
  const closings = flowByWeek(closedRecords, "actual_close_date__c", weeks);
  const newContracts = flowByWeek(newContractRecords, "Contract_Effective_Date__c", weeks);
  const escrow = escrowByWeek(weeks);

  const currentTotalContracts = weeks.map((_, i) =>
    escrow[i].deals === null ? null : closedCum[i].count + escrow[i].deals
  );
  const currentTotalGci = weeks.map((_, i) =>
    escrow[i].gci === null ? null : Math.round((closedCum[i].gci + escrow[i].gci) * 100) / 100
  );

  const metrics = [
    // Company Trends (sheet order)
    { section: "Company Trends", label: "Current Total GCI", format: "money", values: currentTotalGci },
    { section: "Company Trends", label: "Closed GCI", format: "money", values: closedCum.map((c) => c.gci) },
    { section: "Company Trends", label: "Escrow GCI", format: "money", values: escrow.map((e) => e.gci) },
    { section: "Company Trends", label: "Current Total Contracts", format: "int", values: currentTotalContracts },
    { section: "Company Trends", label: "Closed Contracts", format: "int", values: closedCum.map((c) => c.count) },
    { section: "Company Trends", label: "Escrow Contracts", format: "int", values: escrow.map((e) => e.deals) },

    // Weekly Activity Levels
    { section: "Weekly Activity Levels", label: "New Contracts", format: "int", values: newContracts },
    { section: "Weekly Activity Levels", label: "Closings", format: "int", values: closings },
  ];

  return {
    generatedAt: new Date().toISOString(),
    weeks,
    metrics,
  };
}

module.exports = {
  buildScorecard,
  getWeeks,
};
