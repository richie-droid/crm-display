# Crexi Collector

1. Copy `.env.example` to `.env` and fill in the Railway URL and shared secret.
2. Run `npm install`.
3. Run `npm run install-browser`.
4. Run `npm run login`, complete Crexi login or verification, then close the browser.
5. Run `npm run collect` and confirm the count reaches Railway.
6. Schedule `run-crexi-collector.cmd` once daily in Windows Task Scheduler.

The result count is extracted dynamically from visible page text matching `#,### results`; no count is hard-coded. Failed runs are reported without replacing the latest successful value.
