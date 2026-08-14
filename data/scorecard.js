const { getSalesforceToken, querySalesforce } = require("../salesforce/client");

// The scorecard's "Weekly" tab shows the current week plus the previous 4,
// each column dated with that week's Monday. A column dated Monday D represents
// the "beginning of week" state — i.e. cumulative activity through the prior day
// (Sunday, D-1). We reproduce that convention here.

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

async function fetchClosedContractsYtd(instanceUrl, accessToken, throughIso, year) {
  const soql = `
    SELECT actual_close_date__c, Trinity_Commission_Actual__c
    FROM ContractNew__c
    WHERE actual_close_date__c >= ${year}-01-01
      AND actual_close_date__c <= ${throughIso}
  `;
  const result = await querySalesforce(instanceUrl, accessToken, soql);
  return result.records || [];
}

// Cumulative YTD count/GCI of closed contracts as of each week (through week-1 day).
function cumulativeClosed(records, weeks) {
  return weeks.map((week) => {
    // "beginning of week" = through the prior day, i.e. close date strictly before the Monday
    const cutoffExclusive = week; // close_date < Monday  ==  close_date <= Sunday
    let count = 0;
    let gci = 0;
    for (const record of records) {
      const closeDate = String(getField(record, "actual_close_date__c") || "").slice(0, 10);
      if (closeDate && closeDate < cutoffExclusive) {
        count += 1;
        gci += Number(getField(record, "Trinity_Commission_Actual__c") || 0);
      }
    }
    return { week, count, gci: Math.round(gci * 100) / 100 };
  });
}

async function buildScorecard({ anchorDate } = {}) {
  const anchor = anchorDate ? new Date(`${String(anchorDate).slice(0, 10)}T00:00:00.000Z`) : new Date();
  const weeks = getWeeks(anchor);
  const year = Number(weeks[weeks.length - 1].slice(0, 4));

  const token = await getSalesforceToken();

  // One pull covers the whole 5-week span; we slice cumulatively in JS.
  const closedRecords = await fetchClosedContractsYtd(
    token.instance_url,
    token.access_token,
    weeks[weeks.length - 1],
    year
  );
  const closed = cumulativeClosed(closedRecords, weeks);

  const metrics = [
    {
      section: "Company Trends",
      label: "Closed Contracts",
      format: "int",
      values: closed.map((w) => w.count),
    },
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
