# Aplos + Claude Finance Workflow

## Purpose

This workflow connects Aplos financial data to a finance-focused MCP so Claude can help the finance team answer questions, review actuals, identify monthly-close issues, and prepare a human review queue without making accounting changes automatically.

The design is intentionally read-first: Claude can read data, analyze it, flag issues, and structure recommendations, but the finance team remains the final authority for accounting decisions.

---

## Objective

Create a workflow in which finance users can ask natural-language questions about the organization’s finances and receive answers grounded in Aplos data, while the system also identifies items requiring attention before close.

This includes:

- historical analysis
- actual vs. budget review
- spend analysis by category or period
- monthly close exception detection
- missing information / uncategorized item review
- forecast and trend summaries
- Ramp-to-Aplos transaction follow-up when connected

---

## Core workflow

Aplos
  ↓
Finance MCP
  ↓
Claude / Finance Assistant
  ↓
Questions + Analysis + Exception Review
  ↓
Finance Team Review + Final Approval

### Example use cases

Claude can answer questions such as:

- What were our expenses last month?
- How much did we spend on technology this year?
- Compare this month’s expenses to last month.
- What is our current actual vs. budget?
- Which expenses still need to be categorized?
- Which transactions need attention before month-end?
- How are we tracking against forecast?

---

## Monthly close workflow

The system should be able to periodically scan Aplos and identify items that need finance attention.

Aplos → MCP → Automated review → Finance review list

### Items to detect

- uncategorized expenses
- unassigned transactions
- missing or incomplete transaction data
- transactions awaiting review
- month-end checklist items
- budget-to-actual variances
- reconciliation gaps or expected-vs-actual differences

### Output

The system prepares a Finance Review list with:

- count of transactions requiring review
- dollar value of unresolved or unreviewed items
- categories or accounts involved
- items associated with grants, programs, or projects
- items needing human decision / approval

Example:

- 14 transactions require categorization
- 5 transactions require additional information
- $3,240 in expenses remain unreviewed
- 3 items are associated with grant activity
- 2 items require Finance team review

---

## Ramp → Aplos workflow

The workflow can also connect Ramp transaction data into the same review structure.

Ramp
  ↓
Transaction data / webhook / API
  ↓
Finance MCP
  ├─ receipt verification
  ├─ classification support
  ├─ team routing
  ├─ reminder / follow-up
  └─ exception detection
  ↓
Aplos
  ↓
Accounting / monthly close
  ↓
Claude
  ↓
Questions + analysis + reports

This enables a finance workflow where Ramp transactions are reviewed, enriched, and staged for human approval before they become part of the official accounting record in Aplos.

---

## Safety and control model

Claude should be read-first by default.

Allowed:

- read financial records
- analyze transactions
- identify issues
- map patterns and anomalies
- recommend classifications
- summarize findings
- prepare review lists and exception reports

Not allowed by default:

- direct changes to accounting records without approval
- silent posting or classification updates without human review
- automatic ledger edits without explicit approval flow

The final accounting decision must remain with the finance team.

---

## Proposed product name

Aplos Financial Intelligence & Workflow

---

## Brief description

Connect Aplos to the Finance MCP so Claude can answer financial questions, analyze actuals and historical data, support forecasting, and identify items needing attention during the monthly close process. The workflow can also connect Ramp transaction data with Aplos to improve classification, highlight missing information, initiate reminders, and prepare items for human finance review.

---

## Requirements to define before implementation

The following questions need to be answered before building this workflow:

1. What exact Aplos data sources are available?
   - transactions
   - general ledger
   - categories / accounts
   - budgets
   - historical periods
   - close status / review state

2. Is the integration read-only or does it support write actions?
   - This workflow should be read-first unless a separate approved write path is defined.

3. Which finance questions are highest priority for launch?
   - spend by category
   - month-over-month variance
   - budget vs actual
   - uncategorized items
   - forecast tracking

4. What counts as a review item?
   - uncategorized expense
   - missing vendor data
   - grant-related item
   - reconciliation exception
   - pending close step

5. What is the organization’s close process?
   - what tasks happen monthly?
   - what must be reviewed before close is complete?

6. What is the source of truth for forecast and budget data?
   - Aplos only?
   - external planning data?
   - a spreadsheet model?

7. Do we need near-real-time data or scheduled refreshes?
   - daily summary vs. live query support

8. How should the review queue be surfaced?
   - dashboard
   - list view
   - task assignment
   - alerts / reminders

9. How does Ramp transaction data map to Aplos entries?
   - matching rules
   - duplicate handling
   - classification defaults
   - exception workflow

10. What approvals and audit controls are required?
   - who reviews recommendations?
   - what is logged?
   - how are disputed or changed items tracked?

---

## Recommended implementation direction

Start with the most constrained and highest-value phase:

1. Read-only Aplos access
2. Finance Q&A tools for key metrics
3. Monthly close exception detection
4. Human review queue generation
5. Optional Ramp integration
6. Optional forecasting summaries

This creates a safe, useful first version while preserving finance control and governance.
