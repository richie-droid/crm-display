const { getSalesforceToken } = require("../salesforce/client");
const {
  fetchDealOutcomes,
  summarizeCohort,
  addUtcMonths,
  startOfUtcDay,
  formatSoqlDate,
  DEFAULT_WINDOW_MONTHS,
  parseBufferMonths,
} = require("./listingOutcomes");

const TRACKING_FLOOR = new Date(Date.UTC(2023, 4, 1));

function getQuarterlyCheckpoints(now = new Date()) {
  const today = startOfUtcDay(now);
  const quarterMonth = Math.floor(today.getUTCMonth() / 3) * 3;

  let checkpoint = new Date(Date.UTC(today.getUTCFullYear(), quarterMonth, 1));
  const checkpoints = [];

  while (checkpoint >= TRACKING_FLOOR) {
    checkpoints.unshift(checkpoint);
    checkpoint = addUtcMonths(checkpoint, -3);
  }

  return checkpoints;
}

function buildCheckpointWindow(checkpointDate, windowMonths, bufferMonths) {
  const endExclusive = addUtcMonths(checkpointDate, -bufferMonths);
  const start = addUtcMonths(endExclusive, -windowMonths);

  return {
    label: formatSoqlDate(checkpointDate),
    display: formatSoqlDate(checkpointDate),
    start,
    endExclusive,
  };
}

async function buildListingOutcomeTrends({ bufferMonths } = {}) {
  const resolvedBufferMonths = parseBufferMonths(bufferMonths);

  const token = await getSalesforceToken();
  const checkpoints = getQuarterlyCheckpoints();
  const windows = checkpoints.map((checkpoint) =>
    buildCheckpointWindow(checkpoint, DEFAULT_WINDOW_MONTHS, resolvedBufferMonths)
  );

  const overallStart = windows[0].start;
  const overallEndExclusive = windows[windows.length - 1].endExclusive;

  const { outcomes, trackerRecordCount, uniqueDealCount } = await fetchDealOutcomes(
    token,
    overallStart,
    overallEndExclusive
  );

  const points = windows.map((window, index) => {
    const summary = summarizeCohort(outcomes, window);

    return {
      checkpoint: formatSoqlDate(checkpoints[index]),
      totalListings: summary.totalListings,
      closed: summary.closed,
      closeRate: summary.closeRate,
      averageDaysOnMarket: summary.averageDaysOnMarket,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    windowMonths: DEFAULT_WINDOW_MONTHS,
    recencyBufferMonths: resolvedBufferMonths,
    trackerRecordCount,
    uniqueDealCount,
    points,
  };
}

module.exports = {
  buildListingOutcomeTrends,
  getQuarterlyCheckpoints,
};
