# Building 21 Finance Action Plan

## Immediate follow-ups

| Status | Owner | Action | Output / acceptance criteria |
|---|---|---|---|
| Now | Chip | Share the monthly close checklist to Slack | The latest checklist is available to the project team as the authoritative current-state artifact. |
| Now | Chip | Share the Aplos chart of accounts to Slack | Account numbers, names, and any relevant categorization notes are available. |
| Now | Chip | Share the list of all funds | The approximately 25 grant/program funds, names, and useful identifiers are documented. |
| Now | Project team | Send Chip a post-meeting summary | Summary covers what was heard, what will be researched, and what is needed from Chip. |
| Follow-up | Project team + Chip | Schedule a session on government grants | Session covers reimbursement workflow, eligibility evidence, approvals, and submission. |
| Follow-up | Project team + Chip | Schedule a session on projections and forecasting | Session covers Ellie's budgeting dashboard, forecast cadence, inputs, outputs, and ownership. |

## Research and access

| Status | Owner | Action | Questions to answer |
|---|---|---|---|
| Research | Project team | Investigate Ramp's built-in automation | Which close tasks can Ramp solve natively? What triggers, reminders, coding rules, approvals, exports, and API limits exist? |
| Research | Project team | Investigate Wells Fargo connectivity | Is a direct API, Plaid, or another connector appropriate? What data, permissions, history, and reconciliation behavior are available? |
| Needs access | Chip / Ellie | Obtain read access to Ellie's budgeting dashboard | Can the Building 21 MCP read actuals, budgets, projections, and forecast versions without write access? |
| Needs access | Chip | Obtain source artifacts | Monthly close checklist, chart of accounts, fund list, sample Ramp export, sample Aplos report, and representative invoices/receipts. |

## Platform build

| Status | Owner | Action | Initial acceptance criteria |
|---|---|---|---|
| Now | Project team | Build a separate Building 21 MCP | Separate deployment, credentials, data scopes, audit trail, and configuration from the existing Launchpad MCP. Launchpad is represented as a subset. |
| Needs access | Project team | Connect Ramp and Aplos APIs | Read-only discovery tools return documented, validated data with source identifiers and timestamps. |
| Needs access | Project team | Add budgeting dashboard access | The MCP can retrieve approved read-only dashboard data after access and interface details are confirmed. |

## Automation backlog

| Priority | Automation | Trigger | First safe version |
|---|---|---|---|
| 1 | Cardholder close reminders | Five days before month end / close deadline | Query open Ramp transactions and send each cardholder only their missing coding or receipt items. |
| 2 | Chip close summary | Approximately seven days after month end | Send Chip outstanding transactions, incomplete tasks, exceptions, and links to source records. |
| 3 | Transaction pre-quality check | After coding and invoice/receipt availability | Compare account, fund, payee, amount, and documentation; flag likely miscoding for Chip's review. Do not auto-post corrections. |
| 4 | Stakeholder reporting | After monthly close is finalized | Generate tailored reports for Christian Kunkel, Dannyelle Austin, and other approved recipients from Aplos and the budgeting dashboard. |

## Sequencing and dependencies

1. Collect the checklist, chart of accounts, fund list, and representative source files.
2. Confirm the Building 21 versus Launchpad data boundary and MCP ownership.
3. Research Ramp, Wells Fargo, Aplos, and budgeting-dashboard access patterns.
4. Stand up the separate Building 21 MCP with read-only authentication and audit logging.
5. Implement source connectors and normalize source identifiers, accounts, funds, and transaction status.
6. Ship reminders and Chip's summary before attempting AI quality checks.
7. Validate quality-check findings against Chip's historical corrections.
8. Automate stakeholder reports after the close workflow is trusted.

## Decisions still needed

- Who owns deployment, data stewardship, and UI for the Building 21 MCP?
- Which people or systems may receive Slack reminders and financial reports?
- What is the authoritative month-end deadline: calendar month end, settlement wait period, or a checklist-specific date?
- Which transactions and invoices may be sent to an AI model, and what retention/redaction rules apply?
- What approvals are required before a report is distributed externally?
