PIPELINE GROWTH CHALLENGE - FINAL BUILD

Copy these files into the matching project folders.

Routes:
- /pipeline-growth-challenge              Published 8-card scoreboard
- /pipeline-growth-challenge/verification Detailed raw-count verification table
- /pipeline-growth-challenge/admin        Editable weekly call table

Railway configuration:
1. Existing persistent volume must be mounted at /data.
2. Optional explicit data directory:
   PIPELINE_GROWTH_DATA_DIR=/data/pipeline-growth

Call data:
- Period 1 call history is seeded from config/pipeline-growth-calls.csv.
- Live edits are stored at /data/pipeline-growth/calls.json.
- The seed merges into an existing data file only when the seed version advances, without overwriting edits.

Admin workflow:
- Open /pipeline-growth-challenge/admin
- Enter/edit call values directly in the table
- Click Save Calls
- No redeploy is needed for later call updates

Note: the admin endpoint is intentionally unauthenticated (password removed 2026-07-21) — fully internal system, no auth needed for now.
