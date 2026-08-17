const { getSalesforceToken, querySalesforce } = require("../salesforce/client");
const { loadEscrowSnapshots } = require("../storage/escrowSnapshots");

// "In Escrow" is the explicit curated Sub Status on the Contract object.
// GCI uses the projected Trinity contract commission because the actual
// commission (Trinity_Commission_Actual__c) is not booked until close.
const ESCROW_SUB_STATUS = "In Escrow";

const FIELDS = {
  salesPrice: "Contract_Sales_Price__c",
  gci: "Trinity_Contract_Commission_Dollars_form__c",
  sideRepresented: "Side_Represented__c",
};

function getField(record, fieldName) {
  if (!record) return undefined;
  if (record[fieldName] !== undefined) return record[fieldName];
  const key = Object.keys(record).find(
    (k) => k.toLowerCase() === fieldName.toLowerCase()
  );
  return key ? record[key] : undefined;
}

async function getEscrowContracts(instanceUrl, accessToken) {
  const soql = `
    SELECT Id,
           Name,
           ${FIELDS.salesPrice},
           ${FIELDS.gci},
           ${FIELDS.sideRepresented}
    FROM ContractNew__c
    WHERE Sub_Status__c = '${ESCROW_SUB_STATUS}'
    ORDER BY ${FIELDS.salesPrice} DESC
  `;

  const result = await querySalesforce(instanceUrl, accessToken, soql);
  return result.records || [];
}

// Mirrors Closed Transactions: an intermediary contract counts as two deals
// and double volume, while GCI is added once.
function summarizeContracts(records) {
  const summary = records.reduce(
    (summary, record) => {
      const salesPrice = Number(getField(record, FIELDS.salesPrice) || 0);
      const gci = Number(getField(record, FIELDS.gci) || 0);
      const sideRepresented = String(getField(record, FIELDS.sideRepresented) || "");

      const isIntermediary = sideRepresented.toLowerCase().includes("intermediary");
      const dealMultiplier = isIntermediary ? 2 : 1;

      summary.deals += dealMultiplier;
      summary.volume += salesPrice * dealMultiplier;
      summary.gci += gci;

      if (isIntermediary) {
        summary.intermediaryRecords += 1;
      }

      return summary;
    },
    { deals: 0, volume: 0, gci: 0, intermediaryRecords: 0 }
  );

  return {
    deals: summary.deals,
    volume: Math.round(summary.volume),
    gci: Math.round(summary.gci * 100) / 100,
    intermediaryRecords: summary.intermediaryRecords,
  };
}

function percentChange(current, prior) {
  if (prior === null || prior === undefined || prior === 0) return null;
  return ((current - prior) / prior) * 100;
}

function daysBetween(aIso, bIso) {
  const a = new Date(`${aIso}T00:00:00.000Z`).getTime();
  const b = new Date(`${bIso}T00:00:00.000Z`).getTime();
  return Math.round((a - b) / (24 * 60 * 60 * 1000));
}

function formatSnapshotLabel(weekEnding) {
  const [year, month, day] = weekEnding.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

// Find the manually-tracked weekly snapshot nearest to ~52 weeks before today.
function findYearAgoSnapshot(snapshots, todayIso) {
  if (!snapshots.length) return null;

  const target = new Date(`${todayIso}T00:00:00.000Z`);
  target.setUTCFullYear(target.getUTCFullYear() - 1);
  const targetIso = target.toISOString().slice(0, 10);

  let best = null;
  let bestDistance = Infinity;
  for (const snap of snapshots) {
    const distance = Math.abs(daysBetween(snap.weekEnding, targetIso));
    if (distance < bestDistance) {
      best = snap;
      bestDistance = distance;
    }
  }

  return { snapshot: best, targetIso, distanceDays: bestDistance };
}

async function buildEscrowSnapshotDashboard() {
  const tokenData = await getSalesforceToken();

  const records = await getEscrowContracts(
    tokenData.instance_url,
    tokenData.access_token
  );

  const summary = summarizeContracts(records);
  const todayIso = new Date().toISOString().slice(0, 10);

  const current = {
    label: "In Escrow Now",
    deals: summary.deals,
    volume: summary.volume,
    gci: summary.gci,
    intermediaryRecords: summary.intermediaryRecords,
    contractCount: records.length,
  };

  const snapshots = loadEscrowSnapshots();
  const match = findYearAgoSnapshot(snapshots, todayIso);

  // Weekly trend, trailing 12 months (~52 points), oldest -> newest.
  const trailingStart = (() => {
    const d = new Date(`${todayIso}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - 364);
    return d.toISOString().slice(0, 10);
  })();
  const trend = snapshots
    .filter((s) => s.weekEnding >= trailingStart && s.weekEnding <= todayIso)
    .sort((a, b) => a.weekEnding.localeCompare(b.weekEnding))
    .map((s) => ({ weekEnding: s.weekEnding, deals: s.deals, gci: s.gci }));

  let prior = null;
  let comparison = { dealsPct: null, gciPct: null };

  if (match && match.snapshot) {
    prior = {
      label: formatSnapshotLabel(match.snapshot.weekEnding),
      weekEnding: match.snapshot.weekEnding,
      deals: match.snapshot.deals,
      gci: match.snapshot.gci,
      // Volume was never tracked in the manual weekly snapshots.
      volume: null,
      distanceDays: match.distanceDays,
    };

    comparison = {
      dealsPct: percentChange(current.deals, prior.deals),
      gciPct: percentChange(current.gci, prior.gci),
    };
  }

  return {
    generatedAt: new Date(),
    current,
    prior,
    comparison,
    trend,
    hasSnapshots: snapshots.length > 0,
  };
}

module.exports = {
  buildEscrowSnapshotDashboard,
  summarizeContracts,
  findYearAgoSnapshot,
};
