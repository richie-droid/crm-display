# Trinity KPI Dashboard
Version: 1.0
Last Updated: June 2026

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

data/
    closedTransactions.js
    listings.js

pages/
    closedTransactions.js
    listings.js

salesforce/
    client.js

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

API

/api/summary

/api/test-listings

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

Completed

Closed Transactions

Marketing Snapshot

---

# Planned Dashboards

Property Spotlight

Market Activity

Escrow Snapshot

Recently Closed

Agent Leaderboards

Listing Pipeline

National Listing Map

Office KPIs

Market Statistics

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

