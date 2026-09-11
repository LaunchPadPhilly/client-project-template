# Source-of-Truth Data Model — Example Output

**Task:** 4 — Propose Source of Truth Data Model
**This is a template pattern, not a real client.** It builds directly on the [Current Data Model example](02b-current-data-model-example.md) — every duplicate found there gets resolved to exactly one row here.

This is the data dictionary the MCP server and HQ site are built against. When a report or automation needs "the donor's total giving," this document says which system's field is authoritative — no one should have to guess or re-litigate it later.

Grouped by source document/system, matching the sections in the Current Data Model — one table per system, listing only the fields from that system that are canonical. A system section that's missing here (or missing rows) means none of its fields made the cut; see "Fields explicitly excluded" below for why.

## Student/Client Info System

**Domain:** Student

| Canonical Field | Data Type | Definition | Owner | Notes |
|---|---|---|---|---|
| `student.id` | text | Unique identifier for a student/client | Program Director | Also appears in Survey Tool — treated as the same key, not re-derived |
| `student.enrollment_date` | date | Date the student formally enrolled | Program Director | |
| `student.program_track` | category | Which program track the student is in | Program Director | Canonical list of 4 values maintained here, not in any report |
| `student.attendance_pct` | number (%) | Rolling attendance percentage, system-calculated | Program Director | Never hand-edited; if a report disagrees with this, the report is wrong |

## Program Survey Tool

**Domain:** Program

| Canonical Field | Data Type | Definition | Owner | Notes |
|---|---|---|---|---|
| `survey.satisfaction_score` | number (1–5) | Most recent satisfaction score per student | Program Director | |

## QuickBooks (Accounting)

**Domain:** Finance

| Canonical Field | Data Type | Definition | Owner | Notes |
|---|---|---|---|---|
| `finance.transaction_id` | text | Unique transaction identifier | Finance Lead | |
| `finance.amount` | currency | Transaction amount | Finance Lead | |
| `finance.funding_source` | category | Which grant/fund a transaction is charged to | Finance Lead | Canonical naming below resolves the QuickBooks vs. Grant Tracker mismatch |

## Donor CRM

**Domain:** Fundraising

| Canonical Field | Data Type | Definition | Owner | Notes |
|---|---|---|---|---|
| `donor.id` | text | Unique donor identifier | Development Lead | |
| `donor.name` | text | Legal/preferred donor name | Development Lead | **Source of truth for name spelling** — Grant Tracker sheet must match this, not the other way around |
| `donor.total_giving` | currency | Sum of all gifts, computed at query time | Development Lead | Do not maintain a separate "total giving" column anywhere else |

## Shared Drive — Grant Tracker (spreadsheet)

**Domain:** Grants

| Canonical Field | Data Type | Definition | Owner | Notes |
|---|---|---|---|---|
| `grant.name` | text | Canonical grant name | Development Lead | Mapped 1:1 to `finance.funding_source` via the mapping table below — this sheet is being retired once ingestion is live; canonical home becomes the data store itself |
| `grant.reporting_deadline` | date | Next report due date for the grant | Development Lead | |

## Resolved conflicts (from Current Data Model discovery)

| Conflict found | Resolution |
|---|---|
| `student_id` in both SIS and Survey Tool | SIS is source of truth; Survey Tool's `student_id` is a foreign key, not re-defined |
| Donor name spelling differs between Donor CRM and Grant Tracker sheet | Donor CRM is source of truth for donor identity/name; Grant Tracker updated to match on next edit |
| `funding_source` (QuickBooks) vs. `grant_name` (Grant Tracker) use different naming | New mapping table (`grant_funding_source_map`) maintained in the data store; QuickBooks values are the stable key since they're system-generated, not hand-typed |

## Fields explicitly excluded from source-of-truth (and why)

| Field | Why excluded |
|---|---|
| `case_notes` (SIS, free text) | Unstructured, not consistently formatted — revisit once a structured version exists |
| `status` (Grant Tracker, free text) | Being replaced by a structured status enum once the grant tracker is retired |
| Google Drive — Volunteer Roster (all fields) | Not yet wired into the go-live data model; `volunteer_id`, `hours_completed`, and `background_check_date` are flagged Unreliable in the Current Data Model — revisit as its own domain once those are cleaned up |
| Google Drive — Company Overview / Marketing One-Pager | Unstructured narrative, no fields to canonicalize; flagged in Current Data Model as a possible knowledge-base input, not a source-of-truth candidate |
| Google Drive — Q4 2025 Board Report | Downstream re-aggregation of SIS/QuickBooks/Donor CRM, not an independent source — nothing here is canonicalized separately |

## Change control

- This document is versioned in the client repo (`docs/source-of-truth-data-model.md`) — changes go through a pull request, not a silent edit.
- Any new field added after go-live must be added here before it's used in a report or automation.
