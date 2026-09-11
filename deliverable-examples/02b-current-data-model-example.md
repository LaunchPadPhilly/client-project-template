# Current Data Model — Example Output

**Task:** 2 — Document Current Data Model
**This is a template pattern, not a real client.** Replace the source systems and fields with what was found during discovery interviews (see [interview template](02a-interview-question-template.md)).

Filled in live during/after each interview, one section per source system. Every field the stakeholder mentions gets a row — don't pre-filter to "important" fields; the source-of-truth task (Task 4) is where you decide what's canonical.

**Every section needs two things, non-negotiable:**

1. **Source link** — a link to (or location of) the actual system, admin console, API docs, or file, placed right under the section heading. Whoever builds the integration needs to be able to go connect to it directly. If it's not known yet, name who owns access instead of leaving it blank.
2. **Confidence**, on every field row:
   - **Source of truth** — this system is the canonical, trustworthy origin for this field; downstream copies should defer to it.
   - **Unreliable** — flag it, with a short reason (inconsistent formatting, manual/stale entry, incomplete population, unresolved duplicate, etc.). These are exactly the fields that need a cleanup rule before Task 4 can rely on them.

## Student/Client Info System

**Source link:** `https://example-sis.com/admin` (admin console) · API docs at `https://example-sis.com/docs/api`

| Field | Data Type | Example Input | Required? | Confidence | Notes |
|---|---|---|---|---|---|
| student_id | text (system-generated) | `STU-04821` | Required | Source of truth | Primary key in this system |
| first_name | text | `Jordan` | Required | Source of truth | |
| last_name | text | `Alvarez` | Required | Source of truth | |
| enrollment_date | date | `2025-09-03` | Required | Source of truth | |
| program_track | dropdown/category | `Career Readiness` | Required | Source of truth | 4 possible values, list confirmed with Program Director |
| attendance_pct | number (%, calculated) | `92.5` | Calculated | Source of truth | Computed nightly from daily check-ins, not directly editable |
| exit_date | date | `null` | Optional | Source of truth | Blank unless student has exited |
| case_notes | long text | `Referred to housing services 3/2` | Optional | Unreliable — free text, inconsistent format across staff, not standardized | Flagged for follow-up |

## Program Survey Tool

**Source link:** `https://example-surveytool.com/admin` (admin dashboard)

| Field | Data Type | Example Input | Required? | Confidence | Notes |
|---|---|---|---|---|---|
| response_id | text | `RESP-99213` | Required | Source of truth | |
| student_id | text | `STU-04821` | Required | Source of truth | **Duplicate key** — same person as SIS student_id, confirmed same format |
| survey_date | date | `2025-11-14` | Required | Source of truth | |
| satisfaction_score | number (1–5) | `4` | Required | Source of truth | |
| would_recommend | yes/no | `Yes` | Optional | Source of truth | |
| open_feedback | long text | `Staff were really helpful` | Optional | Source of truth | Qualitative only, not meant for aggregation |

## QuickBooks (Accounting)

**Source link:** `https://example-accounting.com/qbo` (company file login) — request read-only accountant access from Finance

| Field | Data Type | Example Input | Required? | Confidence | Notes |
|---|---|---|---|---|---|
| transaction_id | text | `QB-2025-118842` | Required | Source of truth | |
| date | date | `2025-11-01` | Required | Source of truth | |
| account | category | `Program Expense — Career Readiness` | Required | Source of truth | Chart of accounts, ~40 categories |
| amount | currency | `$1,240.00` | Required | Source of truth | |
| funding_source | category | `PA DHS Grant #4471` | Optional | Unreliable — only populated for grant-restricted transactions, blank elsewhere; can't be read as "no funding source" | Flagged as important for grant reporting |
| memo | text | `November stipends` | Optional | Source of truth | |

## Donor CRM

**Source link:** `https://example-donorcrm.com/admin` (admin console)

| Field | Data Type | Example Input | Required? | Confidence | Notes |
|---|---|---|---|---|---|
| donor_id | text | `DNR-3301` | Required | Source of truth | |
| donor_name | text | `Alvarez Family Foundation` | Required | Unreliable — possible duplicate with a name found in the Shared Drive grant tracker | Needs reconciliation |
| gift_date | date | `2025-10-22` | Required | Source of truth | |
| gift_amount | currency | `$5,000.00` | Required | Source of truth | |
| campaign | category | `Fall Appeal 2025` | Optional | Source of truth | |
| is_recurring | yes/no | `No` | Optional | Source of truth | |

## Shared Drive — Grant Tracker (spreadsheet)

**Source link:** `https://drive.example.com/shared/grant-tracker` (Google Sheet) — owned by Development

| Field | Data Type | Example Input | Required? | Confidence | Notes |
|---|---|---|---|---|---|
| grant_name | text | `PA DHS Workforce Grant` | Required | Unreliable — manually maintained, no unique ID column, spelling inconsistent vs. Donor CRM/QuickBooks | Flagged for cleanup in source-of-truth task |
| funder | text | `PA Dept. of Human Services` | Required | Source of truth | |
| amount_awarded | currency | `$150,000.00` | Required | Source of truth | |
| reporting_deadline | date | `2026-01-15` | Required | Source of truth | |
| status | free text | `In progress, report due Jan` | Optional | Unreliable — free text, inconsistent values across rows, no controlled vocabulary | Flagged for cleanup in source-of-truth task |

## Google Drive

The Drive folder mixes structured, semi-structured, and unstructured file types — not every document maps cleanly to a field table. Document what each file actually contains; where there's no tabular data, capture it as a content asset instead of forcing rows into a table. Every file still needs its own source link and its own confidence calls.

### Volunteer Roster (spreadsheet)

**Source link:** `https://drive.example.com/shared/volunteer-roster` (Google Sheet) — owned by Volunteer Coordinator

| Field | Data Type | Example Input | Required? | Confidence | Notes |
|---|---|---|---|---|---|
| volunteer_id | text (manually assigned) | `VOL-0091` | Required | Unreliable — no standard ID scheme, some rows blank | |
| volunteer_name | text | `Pat Nguyen` | Required | Source of truth | |
| email | text | `pat.nguyen@email.com` | Optional | Source of truth | |
| program_assigned | dropdown/category | `Career Readiness` | Optional | Source of truth | Same value list as SIS `program_track` — possible mapping opportunity |
| hours_committed | number | `40` | Optional | Source of truth | |
| hours_completed | number (manually totaled) | `27` | Optional | Unreliable — manually summed at bottom of sheet, not a per-row formula, prone to arithmetic error | |
| background_check_date | date | `2025-08-12` | Optional | Unreliable — missing for ~15% of rows, can't distinguish "not required" from "not yet entered" | |

### Company Overview / Marketing One-Pager (Google Doc — unstructured)

**Source link:** `https://drive.example.com/shared/company-overview` (Google Doc) — owned by Development/Communications

Free-form narrative document, not a field-based data source. Rather than a field table, capture it as a content asset:

| Attribute | Value | Confidence | Notes |
|---|---|---|---|
| Document type | Marketing/company description (prose) | — | Mission statement, program descriptions, impact highlights |
| Owner | Development/Communications | — | Confirm during interview |
| Last updated | `2025-06` (per file metadata) | — | No formal review cadence found |
| Structured data present? | Yes, embedded — e.g. "500 students served" | Unreliable — hard-coded figures, no link back to SIS/QuickBooks, may drift silently | Flag for reconciliation if this doc is ever used in reporting |
| Relevance to data model | Low as a source of truth; possible input to a knowledge base or RAG-style content layer | — | Don't force into the Task 4 source-of-truth mapping — track separately |

### Q4 2025 Board Report (PowerPoint — semi-structured)

**Source link:** `https://drive.example.com/shared/q4-2025-board-report` (Google Slides / PowerPoint) — owned by Executive Director

Mix of narrative slides and embedded data tables/charts pulled from other systems. Document at the slide level rather than with a single field table:

| Slide/Section | Content Type | Source System Referenced | Confidence | Notes |
|---|---|---|---|---|
| Executive summary | Narrative | — | — | No data, prose only |
| Enrollment snapshot | Chart (bar) | SIS (`program_track`, `attendance_pct`) | Unreliable — hand-copied from SIS, not linked, may be stale by the time it's viewed | |
| Financial summary | Table | QuickBooks (`account`, `amount`) | Unreliable — categories manually re-grouped from the QuickBooks chart of accounts, mapping undocumented | |
| Fundraising update | Table | Donor CRM (`gift_amount`, `campaign`) | Unreliable — manual pull from Donor CRM, no linkage or refresh | |
| Program highlights | Narrative + photos | — | — | No data |

Flag: this file re-presents data already captured in SIS, QuickBooks, and the Donor CRM — it's a downstream report, not a new source system. Worth noting in Task 4 as an example of manual re-aggregation that a source-of-truth model could eliminate.

---

## Duplicate / conflicting fields found (carry into Task 4)

- `student_id` appears in both SIS and the Survey Tool with matching format — safe to treat as the same key.
- Donor names appear in both the Donor CRM and the Grant Tracker spreadsheet with inconsistent spelling/formatting — needs a reconciliation rule.
- `funding_source` (QuickBooks) and `grant_name` (Grant Tracker) describe the same real-world grants but use different naming conventions — needs a mapping table.
- `program_assigned` (Volunteer Roster) and `program_track` (SIS) use the same value list but live in different systems — confirm they should map 1:1.
- The Board Report's enrollment, financial, and fundraising slides duplicate SIS, QuickBooks, and Donor CRM data via manual copy/re-grouping rather than a live link — a source of drift, not a new source system.
