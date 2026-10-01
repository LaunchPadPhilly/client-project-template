# Wells Fargo finance workflow

## Purpose

This workflow connects Wells Fargo banking activity into the finance MCP so Claude can help the finance team understand account balances, review transaction movement, and identify items that require attention before close or cash planning.

The emphasis is on visibility and exception review, not on automated changes to bank or accounting data.

---

## Objective

Provide a secure workflow in which finance users can ask natural-language questions about banking and cash activity, while the system also identifies unusual transaction movement, pending review items, and reconciliation issues.

This includes:

- account balances and transaction history
- cash position review
- cash flow and movement analysis
- exception detection for unusual or unreviewed activity
- bank-to-ledger reconciliation support
- project, grant, or vendor-level follow-up where relevant

---

## Core workflow

Wells Fargo
  ↓
Finance MCP
  ↓
Claude / Finance Assistant
  ↓
Cash and transaction review
  ↓
Finance team validation and reconciliation

### Example questions

- What is our current balance across accounts?
- Which transactions were posted this week?
- Which accounts have unusual cash movement?
- Are there pending transactions that need review?
- What is the variance between expected and actual cash position?
- Which transactions may need reconciliation before close?

---

## Typical review areas

The system should be able to review:

- account balances by date and account
- deposits and withdrawals
- transfers between accounts
- recurring or unusual transaction patterns
- transactions awaiting reconciliation
- cash position variance from expectation
- items associated with grants, projects, or departments

---

## Reconciliation workflow

Wells Fargo → MCP → review and exception detection → finance review queue

### Items to detect

- unclassified outgoing payments
- duplicate payments or transfers
- unusually large or suspicious withdrawals
- missing expected cash inflows
- account balance drift from forecast
- transactions that are not yet matched to a source record
- pending items requiring finance follow-up

### Output

The workflow should prepare a review queue with:

- account reference
- amount
- transaction date
- exception type
- expected vs actual variance
- source and reconciliation status
- recommended action

---

## Safety and control model

The Wells Fargo integration should be read-first by default.

Allowed:

- read account balances and transaction history
- summarize cash movement and account health
- flag anomalies and exceptions
- support reconciliation and review actions
- prepare review queues and variance summaries

Not allowed by default:

- initiating transfers or bank actions
- modifying account data or ledger state
- silent decision-making about financial movement without human approval

---

## Scope for the first version

Start with the smallest valuable implementation:

1. account balance lookup
2. transaction history retrieval
3. variance and exception detection
4. simple review queue generation
5. reconciliation notes for finance staff

This allows the project to deliver financial visibility without creating operational risk.
