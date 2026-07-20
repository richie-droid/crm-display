const {
  getSalesforceToken,
  querySalesforceAll,
} = require("../salesforce/client");

const TRACKER_OBJECT = "TTL_Core__Deal_Stage_Tracker__c";

const FIELDS = {
  dealId: "TTL_Core__Deal__c",
  stageName: "Name",
  startDate: "TTL_Core__Start_Date__c",
  endDate: "TTL_Core__End_Date__c",
  dateOnMarket: "first_eblast_date__c",
};

const STAGES = {
  onMarket: "On-Market / Currently Marketing",
  closed: new Set([
    "Closed",
    "On Market Listing Closed",
  ]),
};

function addUtcMonths(date, months) {
  const result = new Date(date.getTime());
  const originalDay = result.getUTCDate();

  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);

  const lastDayOfTargetMonth = new Date(
    Date.UTC(
      result.getUTCFullYear(),
      result.getUTCMonth() + 1,
      0
    )
  ).getUTCDate();

  result.setUTCDate(
    Math.min(originalDay, lastDayOfTargetMonth)
  );

  return result;
}

function startOfUtcDay(date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    )
  );
}

function formatSoqlDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatWindowLabel(start, endExclusive) {
  const endInclusive = new Date(
    endExclusive.getTime() - 24 * 60 * 60 * 1000
  );

  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  return `${formatter.format(start)} - ${formatter.format(endInclusive)}`;
}

function getCohortWindows(now = new Date()) {
  const today = startOfUtcDay(now);

  const currentStart = addUtcMonths(today, -18);
  const currentEnd = addUtcMonths(today, -6);
  const priorStart = addUtcMonths(today, -30);
  const priorEnd = currentStart;

  return {
    current: {
      label: "Current Cohort",
      start: currentStart,
      endExclusive: currentEnd,
      display: formatWindowLabel(
        currentStart,
        currentEnd
      ),
    },
    prior: {
      label: "Prior-Year Cohort",
      start: priorStart,
      endExclusive: priorEnd,
      display: formatWindowLabel(
        priorStart,
        priorEnd
      ),
    },
  };
}

function parseDate(value) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isWithinWindow(date, window) {
  return (
    date >= window.start &&
    date < window.endExclusive
  );
}

function calendarDayDifference(start, end) {
  const startDay = startOfUtcDay(start);
  const endDay = startOfUtcDay(end);

  return Math.round(
    (endDay - startDay) /
      (24 * 60 * 60 * 1000)
  );
}

function groupTrackerRecords(records) {
  const deals = new Map();

  for (const record of records) {
    const dealId = record[FIELDS.dealId];
    const stageName = String(
      record[FIELDS.stageName] || ""
    ).trim();
    const startDate = parseDate(
      record[FIELDS.startDate]
    );

    if (!dealId || !stageName || !startDate) {
      continue;
    }

    if (!deals.has(dealId)) {
      deals.set(dealId, {
        dealId,
        dealName:
          record.TTL_Core__Deal__r?.Name ||
          "Unnamed Deal",
        dateOnMarket: parseDate(
          record.TTL_Core__Deal__r?.[FIELDS.dateOnMarket]
        ),
        trackerRows: [],
      });
    }

    deals.get(dealId).trackerRows.push({
      stageName,
      startDate,
      endDate: parseDate(
        record[FIELDS.endDate]
      ),
    });
  }

  return deals;
}

function deriveDealOutcome(deal) {
  const onMarketDate = deal.dateOnMarket;

  if (!onMarketDate) {
    return null;
  }

  const onMarketRows = deal.trackerRows
    .filter(
      (row) => row.stageName === STAGES.onMarket
    )
    .sort((a, b) => a.startDate - b.startDate);

  const closeRows = deal.trackerRows
    .filter(
      (row) =>
        STAGES.closed.has(row.stageName) &&
        row.startDate >= onMarketDate
    )
    .sort((a, b) => a.startDate - b.startDate);

  const closedDate = closeRows.length
    ? closeRows[0].startDate
    : null;

  const isAvailable =
    !closedDate &&
    onMarketRows.some((row) => !row.endDate);

  return {
    dealId: deal.dealId,
    dealName: deal.dealName,
    onMarketDate,
    closedDate,
    isClosed: Boolean(closedDate),
    isAvailable,
    daysOnMarket: closedDate
      ? calendarDayDifference(
          onMarketDate,
          closedDate
        )
      : null,
  };
}

function summarizeCohort(outcomes, window) {
  const cohortDeals = outcomes.filter(
    (deal) =>
      isWithinWindow(deal.onMarketDate, window)
  );

  const closedDeals = cohortDeals.filter(
    (deal) => deal.isClosed
  );

  const availableDeals = cohortDeals.filter(
    (deal) => deal.isAvailable
  );

  const totalListings = cohortDeals.length;
  const closed = closedDeals.length;
  const available = availableDeals.length;
  const closeRate = totalListings
    ? closed / totalListings
    : 0;

  const averageDaysOnMarket = closed
    ? closedDeals.reduce(
        (total, deal) =>
          total + deal.daysOnMarket,
        0
      ) / closed
    : 0;

  return {
    label: window.label,
    display: window.display,
    start: formatSoqlDate(window.start),
    endExclusive: formatSoqlDate(
      window.endExclusive
    ),
    totalListings,
    closed,
    available,
    otherInactive:
      totalListings - closed - available,
    closeRate,
    averageDaysOnMarket:
      Math.round(averageDaysOnMarket * 10) / 10,
  };
}

function percentChange(current, prior) {
  if (!prior) return null;
  return ((current - prior) / prior) * 100;
}

function buildComparison(current, prior) {
  return {
    totalListingsPct: percentChange(
      current.totalListings,
      prior.totalListings
    ),
    closedPct: percentChange(
      current.closed,
      prior.closed
    ),
    availablePct: percentChange(
      current.available,
      prior.available
    ),
    closeRatePoints:
      (current.closeRate - prior.closeRate) * 100,
    averageDaysChange:
      current.averageDaysOnMarket -
      prior.averageDaysOnMarket,
    averageDaysPct: percentChange(
      current.averageDaysOnMarket,
      prior.averageDaysOnMarket
    ),
  };
}

async function buildListingOutcomesDashboard() {
  const token = await getSalesforceToken();
  const windows = getCohortWindows();

  const relevantStages = [
    STAGES.onMarket,
    ...STAGES.closed,
  ]
    .map(
      (stage) =>
        `'${stage.replace(/'/g, "\\'")}'`
    )
    .join(", ");

  const soql = `
    SELECT
      Id,
      ${FIELDS.dealId},
      TTL_Core__Deal__r.Name,
      TTL_Core__Deal__r.${FIELDS.dateOnMarket},
      ${FIELDS.stageName},
      ${FIELDS.startDate},
      ${FIELDS.endDate}
    FROM ${TRACKER_OBJECT}
    WHERE
      TTL_Core__Deal__r.${FIELDS.dateOnMarket} >= ${formatSoqlDate(
        windows.prior.start
      )}
      AND TTL_Core__Deal__r.${FIELDS.dateOnMarket} < ${formatSoqlDate(
        windows.current.endExclusive
      )}
      AND ${FIELDS.stageName} IN (
        ${relevantStages}
      )
    ORDER BY
      ${FIELDS.dealId},
      ${FIELDS.startDate} ASC
  `;

  const result = await querySalesforceAll(
    token.instance_url,
    token.access_token,
    soql
  );

  const groupedDeals = groupTrackerRecords(
    result.records || []
  );

  const outcomes = Array.from(
    groupedDeals.values()
  )
    .map(deriveDealOutcome)
    .filter(Boolean);

  const current = summarizeCohort(
    outcomes,
    windows.current
  );

  const prior = summarizeCohort(
    outcomes,
    windows.prior
  );

  return {
    generatedAt: new Date().toISOString(),
    dataThrough: new Date().toISOString().slice(0, 10),
    trackerRecordCount:
      result.records?.length || 0,
    uniqueDealCount: groupedDeals.size,
    current,
    prior,
    comparison: buildComparison(current, prior),
  };
}

module.exports = {
  buildListingOutcomesDashboard,
  getCohortWindows,
};
