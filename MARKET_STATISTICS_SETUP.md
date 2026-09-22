# Market Statistics Dashboard Setup

## New routes

- `/market-statistics` — TV display page
- `/api/market-statistics` — latest values and history
- `/api/market-statistics/ingest` — protected Crexi collector endpoint
- `/api/market-statistics/refresh` — protected manual Salesforce/Treasury refresh

## Railway variables

Add:

```text
METRICS_INGEST_SECRET=<long-random-secret>
METRICS_DATA_DIR=/data/market-statistics
```

Create and mount a Railway persistent volume at `/data`. Without a persistent volume, metric history can be lost during redeployments.

The server collects Trinity active listings and the official U.S. Treasury five-year par yield at startup and once every 24 hours. A failed refresh is logged but does not delete the most recent successful value.

## Crexi collector

The collector runs on a Windows computer with a persistent Playwright browser profile.

```text
cd crexi-collector
copy .env.example .env
npm install
npm run install-browser
npm run login
npm run collect
```

During `npm run login`, complete Crexi login and any human verification, verify the saved search loads, then close the browser. The normal collection command dynamically extracts the visible `#,### properties` value from the search results header and posts the current count and capture timestamp to Railway.

Schedule `crexi-collector/run-crexi-collector.cmd` once daily using Windows Task Scheduler. Run it under the same Windows account that created the browser profile.

## Historical import

When historical data is available, create a CSV:

```csv
date,value
2026-01-01,8800
2026-02-01,8925
```

Then run:

```text
node scripts/import-metric-history.js history.csv crexi_listing_count
```

Valid metric keys:

- `crexi_listing_count`
- `trinity_listing_count`
- `five_year_treasury`

## The tracked Crexi search

`CREXI_SAVED_SEARCH_URL` in `crexi-collector/.env` must be:

```text
https://www.crexi.com/search?tableView=true&tenancy.tenancyType_value=Single&searchAttributes.status_tree_Active=&financials.capRatePercent_min=2&searchType=Sales&sorting=listingAttributes.dateActivated_desc_0&showMap=false
```

That is saved search `2165339` (all active single-tenant sales listings at a 2%+ cap rate). The collector builds a fingerprint from this URL's filter parameters — ignoring cosmetic ones such as `tableView`, `showMap`, `sorting` and `savedSearchId` — and refuses to record a count from a page whose filters do not match.

**Do not leave a different Crexi saved search open in the collector's Chrome profile.** Before the URL check existed, the collector reused any open `crexi.com/search` tab and merely reloaded it. On 2026-09-16 a QSR/Fast Food saved search was opened in that window and left there, so every run from 2026-09-17 to 2026-09-22 recorded roughly 870 QSR listings instead of roughly 9,500 single-tenant listings. Those six days were reconstructed by interpolation and carry the source `crexi_backfill_estimate`.

## Guardrails

- The collector always navigates to `CREXI_SAVED_SEARCH_URL`; it never reloads whatever the tab was showing.
- After the page settles, the collector re-checks the final URL's filters and fails the run if they drifted.
- `/api/market-statistics/ingest` rejects a count that differs from the last recorded value by more than 25% and records it as a failed attempt, so the dashboard holds the last good value and shows its age. Send `"confirmLargeChange": true` to override when a jump is genuinely real.

## Correcting history

`/api/market-statistics/correct` overwrites specific days. It requires the ingest secret and an explicit `source` per entry:

```json
{
  "entries": [
    {
      "metricKey": "crexi_listing_count",
      "value": 9473,
      "capturedAt": "2026-09-17T14:00:19.737Z",
      "source": "crexi_backfill_estimate"
    }
  ]
}
```

## Operational behavior

- Status (July 2026): the Windows Task Scheduler job is running successfully on schedule with no manual intervention required.
- Crexi failures are stored as failed attempts.
- Failed attempts never overwrite the last successful count.
- The TV page shows the capture date for the currently displayed value.
- Local collector output is appended to `crexi-collector/collector.log` when run through the CMD file.
