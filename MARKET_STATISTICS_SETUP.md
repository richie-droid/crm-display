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

During `npm run login`, complete Crexi login and any human verification, verify the saved search loads, then close the browser. The normal collection command dynamically extracts the visible `#,### results` value and posts the current count and capture timestamp to Railway.

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

## Operational behavior

- Crexi failures are stored as failed attempts.
- Failed attempts never overwrite the last successful count.
- The TV page shows the capture date for the currently displayed value.
- Local collector output is appended to `crexi-collector/collector.log` when run through the CMD file.
