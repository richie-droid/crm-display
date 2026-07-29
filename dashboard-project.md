# Trinity KPI Dashboard
Version: 1.1
Last Updated: July 2026

---

# Project Overview

The Trinity KPI Dashboard is a web-based digital signage platform that displays live operational metrics for Trinity Real Estate Investment Services (Trinity REIS).

The application is designed specifically for large-format televisions throughout the office using NovaSign as the display platform.

The dashboards are intended to communicate the health of the business at a glance rather than provide detailed operational reporting.

Primary design goals:

- Readable from approximately 12 feet away
- Optimized for 55" 16:9 televisions
- Extremely low maintenance
- Daily data refresh is sufficient
- Consistent visual language across all pages
- Modular architecture allowing rapid creation of new dashboards

---

# Overall Architecture

```
Salesforce
        │
        ▼
salesforce/client.js
        │
        ▼
data/*.js
(Business Logic / SOQL)
        │
        ▼
pages/*.js
(HTML Renderer)
        │
        ▼
server.js
(Routing only)
        │
        ▼
Railway
        │
        ▼
NovaSign Playlist
        │
        ▼
Office TVs
```

---

# Technology Stack

Backend

- Node.js
- Express

Salesforce

- OAuth Authentication
- REST API
- SOQL Queries

Hosting

- Railway

Display

- NovaSign
- Embedded Web Pages

Version Control

- Git
- GitHub

---

# Repository Structure

```
config/
    teams.js
    pipeline-growth-roster.csv
    pipeline-growth-calls.csv

data/
    closedTransactions.js
    listings.js
    individualPerformance.js
    listingOutcomes.js
    marketStatistics.js
    pipelineGrowthChallenge.js

pages/
    closedTransactions.js
    listings.js
    individualPerformance.js
    listingOutcomes.js
    marketStatistics.js
    pipelineGrowthChallenge.js
    pipelineGrowthVerification.js
    pipelineGrowthAdmin.js

salesforce/
    client.js

storage/
    metricStore.js
    pipelineGrowthCalls.js
    seedMetricHistory.js
    data/ (persisted snapshots — gitignored)

scripts/
    backfill-treasury-history.js
    import-metric-history.js

historical-data/
    crexi-history.csv
    trinity-listing-history-90-days.csv

crexi-collector/
    collector.js
    (separate Node project; see crexi-collector/README.md)

server.js

package.json
```

---

# Design Philosophy

This application is NOT intended to function like a desktop application.

It is a passive information display.

Every page should communicate its message within approximately five seconds.

Large numbers are always preferred over dense tables.

Every page should follow a consistent visual language.

Dark background.

Blue / Green Trinity palette.

Minimal animation.

No unnecessary decorations.

---

# Standard Page Layout

Every dashboard follows the same structure.

```
------------------------------------------------

LOGO                    PAGE TITLE

------------------------------------------------

Primary KPI Cards

------------------------------------------------

Supporting Visuals

------------------------------------------------
```

The goal is consistency.

A viewer should immediately understand every dashboard because they all follow the same design language.

---

# Brand Colors

Primary Navy

#15445B

Primary Blue

#4E92C7

Accent Green

#BFDBBB

Background

#02070A

Primary Text

#FEFAF6

---

# Viewing Assumptions

Displays

- 55"
- 1920×1080
- Landscape

Viewing Distance

Approximately 12 feet

Implications

Large typography

Minimal clutter

High contrast

No unnecessary detail

---

# Routing

Root

/

Redirects to

/closed-production

Pages

/closed-production

/listings

/individual-performance

/listing-outcomes

/listing-outcomes/trends

/market-statistics

/pipeline-growth-challenge

/pipeline-growth-challenge/verification

/pipeline-growth-challenge/admin

API

/api/summary

/api/test-listings

/api/individual-performance

/api/listing-outcomes

/api/listing-outcomes/trends

/api/market-statistics

/api/market-statistics/ingest (protected — Crexi collector only)

/api/market-statistics/refresh (protected — manual refresh)

/api/pipeline-growth-challenge

/api/pipeline-growth-challenge/debug

/api/pipeline-growth-challenge/calls (GET + POST, unauthenticated by design — see Pipeline Growth Challenge section)

Health

/health

---

# Salesforce Integration

Authentication

Shared OAuth connection.

Implemented in

salesforce/client.js

No page performs authentication directly.

Every data module uses the shared client.

---

# Data Modules

Every page has exactly one data module.

Responsibilities

Query Salesforce

Apply business rules

Normalize data

Return clean JavaScript objects

Never generate HTML.

---

# Page Modules

Every page has exactly one page renderer.

Responsibilities

Receive normalized data.

Render HTML.

Render CSS.

No business logic.

No SOQL.

---

# Server Responsibilities

server.js is intentionally minimal.

Responsibilities

Define routes.

Call data module.

Call renderer.

Return HTML.

Nothing else.

---

# Closed Transactions Dashboard

Route

/closed-production

Purpose

Executive production snapshot.

Metrics

Closed Deals

Closed Volume

Closed GCI

Current Year vs Prior Year

Business Rules

Intermediary transactions count as two deals.

Volume doubled for intermediary representation.

Uses

Trinity_Commission_Actual__c

for GCI.

---

# Marketing Snapshot Dashboard

Route

/listings

Purpose

Provide a live overview of the firm's marketing inventory.

Top KPIs

Active Listings

Active Volume

Average Cap Rate

Upcoming Listings

Supporting Panels

Upcoming Listings

Recent Listings

Listing Row Layout

Property Name

Broker • Price • Cap Rate

---

# Listings Business Rules

Include records where

On_Off_Market = On-Market

Active Statuses

On-Market / Currently Marketing

Escrow/Due Diligence

Agreed To (counts as active only when a date-on-market value is present)

Agreed To sits between Currently Marketing and In Escrow. It is only used by one team, but is a legitimate status everywhere and should count as active for any team that uses it.

Upcoming Statuses

Listing Submitted to Admin

Waiting on details from agent

Listing submitted to Agent

Agent Approved

Listing Waiting on Agent

Upcoming listings additionally require

Listing_Agreement_Signed__c

NOT NULL

---

# Listing Price Logic

Two Salesforce fields exist.

TTL_Core__Listing_Price_Total__c

Listing_Price_if_no_NOI__c

Only one is populated.

Dashboard always uses

Listing Price Total

otherwise

Listing Price (if no NOI)

---

# State Logic

Property_State__c is often blank.

Fallback parser extracts state abbreviation from

MSF_Property_Name__c

Examples

Tenant | City, TX

Tenant | City TX

---

# Team Mapping

Defined in

config/teams.js

Individual agents are mapped into fixed teams.

Current Teams

T5 Advisors

Strad

AGTeam

MC$

QSR Team

Agents without mappings display individually.

This mapping is used only by the Marketing Snapshot dashboard (listingLeader).

The Pipeline Growth Challenge uses a separate, independent roster: config/pipeline-growth-roster.csv (8 teams, broader agent coverage). The two systems are intentionally kept separate and are not expected to be unified — they will only converge if the company reaches a point where there are no solo agents.

---

# Project Principles

Business logic belongs in

data/

Presentation belongs in

pages/

Routing belongs in

server.js

Never duplicate SOQL logic.

Never mix HTML with business logic.

Every new dashboard should follow the same architecture.

---

# NovaSign

Each dashboard is an independent URL.

Example

/closed-production

/listings

Each page refreshes once per day.

86400 seconds

Railway remains responsible for serving current data.

---

# Current Dashboards

Live on TVs

Closed Transactions

Marketing Snapshot

Individual Performance

Market Statistics

Pipeline Growth Challenge

Built, Not Yet Live

Listing Outcomes (pending partner review)

Listing Outcome Trends (sister page, not TV-bound, fixed preset range)

---

# Planned Dashboards

Next priority: TBD (as of July 2026)

Property Spotlight

Market Activity

Escrow Snapshot

Recently Closed

Agent Leaderboards

Listing Pipeline

National Listing Map

Office KPIs

Company Announcements

---

# Future Improvements

Shared CSS file

Shared layout template

Shared header component

SVG logo

Property images

Caching layer

Daily scheduled refresh

Automatic slideshow mode

Animation framework

Error monitoring

---

# Coding Standards

Prefer readability over cleverness.

One page.

One data module.

One renderer.

One route.

Maintain consistent formatting across all pages.

Every dashboard should feel like part of one application.


---

# Individual Performance Dashboard (July 2026)

Status

Data layer complete.
UI in active refinement.

Route (planned)

`/individual-performance`

Purpose

Provide a live view of individual broker performance across activity, pipeline, and production.

Layout

Three vertical KPI cards:

1. Total Calls (Last 30 Days)
2. Accepted LOIs (Last 30 Days)
3. YTD Individual GCI

Uses the same header, branding, typography, and dark Trinity design language as the other dashboard pages.

## Calls

Source Object

`Task`

Filters

- `Subject != null`
- `ActivityDate = LAST_N_DAYS:30`
- `Same_Day_Check__c = TRUE`

Implementation Notes

- Uses the standard Salesforce Task object.
- Salesforce REST query pagination was required because results exceeded the default page size.
- `querySalesforceAll()` was added to `salesforce/client.js` to automatically follow `nextRecordsUrl`.
- Dashboard displays all agents ranked by total calls.
- UI uses two columns within the card to fit all agents.

## Accepted LOIs

Source Objects

- `TTL_Core__Offer__History`
- `TTL_Core__Offer__c`

Logic

1. Query Offer History.
2. Filter:
   - `Field = 'TTL_Core__Offer_Status__c'`
   - `CreatedDate = LAST_N_DAYS:30`
3. Keep only history rows where:
   - `NewValue = 'Accepted'`
4. Remove duplicate ParentIds.
5. Query Offer records.
6. Attribute each accepted LOI using:
   - `Procuring_Agent__c`

Displays Top 10 agents by accepted LOIs.

## YTD Individual GCI

Source Object

`Commission__c`

Filters

- `Close_Date__c >= January 1 (current year)`
- `Close_Date__c <= TODAY`
- `Contract_Sub_Status__c = 'Closed'`

Business Rules

Primary Side

`P_Agent_n__c × TS_PA_n__c × Primary_GCI__c`

Intermediary Side

`I_Agent_n__c × TS_IA_n__c × Intermediary_GCI__c`

Split Handling

Blank Team Split fields represent 100% ownership.

Normalization

- Split values greater than 1 are treated as percentages (50 -> 0.50).
- Decimal values (0.50) are preserved.
- Blank values normalize to 1.00.

Transaction Fee

A flat $750 per-deal fee is subtracted from gross GCI (Primary_GCI__c / Intermediary_GCI__c) before agent splits are applied. This is a real, universal fee. It is intentionally NOT applied to the Closed Transactions dashboard's GCI figure — that dashboard reports the company/team-level Trinity_Commission_Actual__c total from ContractNew__c, a different object serving a different purpose than Commission__c's per-agent net calculation. The two GCI numbers are not expected to reconcile to each other.

Excluded Agents

Barrett Brown and Justin Williams are hard-excluded from the GCI leaderboard (departed agents), via the EXCLUDED_AGENTS set in data/individualPerformance.js. This list is intentionally unmanaged/ad hoc — no admin workflow exists to maintain it. Edit that set directly if a departed agent still appears on screen; don't add process overhead beyond that.

Note: Trinity's Salesforce org is planned for a rebuild later in 2026, which is expected to drive changes to this data model. The current approach is considered sufficient until then.

Validation

Trevor Short's YTD GCI was used to validate calculation logic.

Expected

315,665.64

Calculated

315,665.64

Result

Calculation confirmed.

## Salesforce Client Enhancement

Added

`querySalesforceAll()`

Purpose

Automatically follows Salesforce `nextRecordsUrl` until all records have been retrieved.

Used by high-volume datasets such as Tasks.

## Current Project Status

Completed

- Closed Transactions Dashboard
- Marketing Snapshot Dashboard
- Individual Performance data layer

Current Work

- Final UI polish for Individual Performance page.
- Reconcile remaining individual GCI values.
- Match header styling to existing dashboards.
- Optimize ranking layout and spacing.

---

# Listing Outcomes Dashboard (July 2026)

Status

Fully built. Not yet on TVs — pending review with partners. Not TV-constrained: this page (and its trends sister page) are exploration/analysis tools, not passive signage, so they intentionally use interactive form controls rather than following the other dashboards' fixed-display design.

Route

`/listing-outcomes`

Purpose

Compare listing close-rate and days-on-market outcomes across two cohorts of listings launched by date-on-market.

Source Object

`TTL_Core__Deal_Stage_Tracker__c` (stage history per deal)

Cohort Windows (adjustable, added July 2026)

The page has a form (Anchor Date + Window Length in months, submitted via a plain GET) so cohorts can be recomputed on demand instead of being fixed to "today."

- Recency buffer is fixed at 9 months: the current cohort always ends 9 months before the anchor date, so listings have had time to actually close.
- Current Cohort: [anchor − 9mo − windowMonths, anchor − 9mo).
- Prior Cohort: the same window length, immediately preceding the current cohort.
- Defaults: anchor = today, window length = 12 months (matches the original fixed behavior).

Metrics (per cohort)

- New Listings Launched
- Closed
- Still Available (open On-Market stage, no qualifying close)
- Close Rate
- Average Days on Market (closed listings only)

Data Reliability

Deal Stage Tracker history is sound back to when tracking began (April 2023). Going back further than that would introduce gaps.

---

# Listing Outcome Trends (July 2026)

Status

Fully built, sister page to Listing Outcomes. Not TV-bound. Fixed preset range (no adjustable controls).

Route

`/listing-outcomes/trends`

Purpose

Four line charts (New Listings Launched, Closed, Close Rate, Avg Days on Market) showing quarterly checkpoints over time, so trends are visible at a glance rather than only comparing two cohorts.

Checkpoints

- One point per calendar quarter (Jan 1 / Apr 1 / Jul 1 / Oct 1), from the most recent quarter back through Jul 1, 2023 (the earliest calendar-quarter start on/after May 2023, since Deal Stage Tracker data begins April 2023).
- Each point reuses the exact same trailing-window formula as the main cohort page (12-month window, 9-month recency buffer), just recalculated at each checkpoint date instead of only "today" — so every point is directly comparable to the others and to the main page's methodology.
- Implementation fetches Deal Stage Tracker data once across the whole span needed, then derives each checkpoint's metrics from that single dataset, rather than issuing one Salesforce query per checkpoint.

---

# Market Statistics Dashboard (July 2026)

Status

Live.

Route

`/market-statistics`

Purpose

Track Trinity's active listing count, Crexi's competitive listing count, and the 5-year U.S. Treasury yield over time, each with a 90-day trend chart.

Details

See MARKET_STATISTICS_SETUP.md for routes, environment variables, and the Crexi collector setup. The Crexi collector runs on a schedule via Windows Task Scheduler and is operating successfully with no manual effort required.

---

# Pipeline Growth Challenge (July 2026)

Status

Live. Currently mid-competition. This is a recurring program — Richie owns updating the competition period dates for each future round.

Routes

- `/pipeline-growth-challenge` — TV scoreboard
- `/pipeline-growth-challenge/verification` — raw record-count verification table
- `/pipeline-growth-challenge/admin` — editable weekly call-count table

Purpose

A gamified sales competition comparing a Baseline Period against a live Challenge Period, scored across five weighted categories, with team leaderboards and "Growth Maxxer" / "Team Anchor" callouts.

Scoring (fixed, reused across future rounds)

- Calls: 1 point
- Proposals: 200 points
- Listings: 2,000 points
- Accepted LOIs: 2,000 points
- Contracts: 4,000 points

Team Roster

Uses its own roster, config/pipeline-growth-roster.csv (8 teams), independent from config/teams.js. See Team Mapping section.

Calls Data

Not every agent call is logged in Salesforce Tasks, so calls for this dashboard are entered manually each week via the admin page rather than pulled automatically (unlike Individual Performance, which uses Task records directly). Accuracy matters more here because real rewards are tied to standings. Long-term goal is to unify both dashboards onto the same call-count source once the underlying data-completeness gap in Salesforce is resolved.

Admin Access

The call-entry endpoint (`/api/pipeline-growth-challenge/calls`) has no authentication. This is a deliberate, permanent-for-now decision (password removed 2026-07-21) — this is a fully internal system with no realistic threat model requiring auth.

