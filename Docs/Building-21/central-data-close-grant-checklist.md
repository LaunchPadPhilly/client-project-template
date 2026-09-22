# Central data sheet, monthly close, and grant reporting checklist

Consolidates open items from [`building-21-finance-action-plan.md`](building-21-finance-action-plan.md),
[`finance-workflows-and-automation.md`](finance-workflows-and-automation.md), and
[`../Aplos/monthly-close.md`](../Aplos/monthly-close.md) into one checklist covering three
areas: connecting the central data sheet (Ellie's budgeting dashboard) to the models/close
workflow, what monthly close can actually be automated now vs. later, and what has to
change in current grant reporting before any automation touches it. Nothing here has been
confirmed by Chip or Ellie yet — nothing is marked done until they confirm it.

## 1. Connecting the central data sheet to the models/close workflow

"Central data sheet" = Ellie's budgeting dashboard (actuals vs. budget, projections,
re-forecasting). It's explicitly out of scope for detailed implementation today
(`finance-workflows-and-automation.md` → Actuals, budgets, and projections) but the close
and reporting workflows depend on it, so the connection has to be scoped before Phase 3.

- [ ] Confirm who owns the budgeting dashboard's data model (Ellie) and get read access
      terms — API, export, shared sheet, or something else.
- [ ] Document the dashboard's actual data model: forecast versions, update cadence,
      fiscal-year structure (Building 21 runs July–June), and how actuals get into it.
- [ ] Confirm the Aplos ↔ budgeting-dashboard join key(s) — account, fund, program,
      period — so actuals and budget/forecast rows can be matched without manual mapping.
- [ ] Decide whether the Building 21 MCP reads the dashboard directly or reads a
      finance-approved export/snapshot instead (avoids exposing live dashboard formulas
      or unapproved draft numbers).
- [ ] Define "approved" vs. "draft" dashboard state — reporting (§3.3 below) must only
      pull from an approved snapshot, never an in-progress one.
- [ ] Confirm the ~25 grant/program fund list and chart of accounts are the same
      reference data used by both Aplos and the dashboard (no separate fund naming to
      reconcile).
- [ ] Hold the dedicated follow-up session on projections/forecasting named in the action
      plan before building any integration logic against the dashboard.

## 2. Monthly close — what can be automated now vs. what needs to change

Current state (from `finance-workflows-and-automation.md`): Chip waits 5–6 days after
month end, then works a manual checklist across Ramp coding, Aplos import, Wells Fargo
bank/brokerage reconciliation, benefits/payroll docs to Leonilla, and a final QA pass. The
biggest bottleneck is chasing cardholders for uncoded transactions and missing receipts.

### Can automate now (read-only, Phase 1–2 per the delivery phases)

- [ ] Cardholder completeness reminders — open Ramp transactions with missing
      account/fund code or receipt, sent individually 5 days before close deadline.
- [ ] Chip's close summary — unresolved Ramp items, Aplos import status, bank-feed
      exceptions, missing documents, checklist state, ~7 days after month end.
- [ ] Uncategorized/incomplete transaction detection in Aplos (`Aplos/monthly-close.md`
      §1) — missing category, vendor, memo, department/project.
- [ ] Budget vs. actual variance flags (`Aplos/monthly-close.md` §2) — needs the
      dashboard connection from §1 above for anything beyond Aplos-native budget data.
- [ ] Pre-quality-check flags for likely miscoding (compare coded transaction against
      invoice/receipt) — flag only, Chip disposes every item, no auto-correction.
- [ ] Structured review queue (issue type, reference, amount, date, category, owner,
      urgency, recommended action, status) so close items are trackable, not just a list.

### Must stay human-controlled (non-negotiable per existing docs)

- [ ] Wells Fargo brokerage reconciliation — legally required, stays a controlled human
      step unless requirements explicitly change.
- [ ] Any correction to Aplos or Ramp records — analysis/flagging only, no auto-write.
- [ ] Marking the close itself complete — the review queue is decision support, not
      authority (`Aplos/monthly-close.md` — Human approval requirement).
- [ ] Final sign-off on which flagged items are resolved vs. carried forward.

### Still needs a decision before it can be automated

- [ ] Which issues are auto-flagged vs. manually reviewed, and what thresholds trigger
      escalation (open question in `Aplos/monthly-close.md`).
- [ ] Which fields are mandatory before close (drives what "incomplete transaction"
      means).
- [ ] Which review list is the official source of truth for close work.
- [ ] Authoritative month-end deadline definition: calendar month end, settlement wait
      period, or a checklist-specific date (open question in the action plan).
- [ ] Retention/redaction rules for which transactions/invoices may be sent to an AI
      model.

## 3. Grant reporting — what needs to change before automation

Per `finance-workflows-and-automation.md` → Government grant reimbursement: this workflow
"was not covered in enough depth to implement responsibly" and is currently **entirely
manual** — reviewing expenses, checking the grant budget, building an itemized invoice,
and submitting it. Nothing below should be built until the follow-up discovery session
happens; this is the checklist for that session and the changes it should produce.

### Current-state gaps to close first

- [ ] Grant-specific eligibility rules and budget categories are not documented anywhere
      in this repo yet — need them per grant, not just per fund.
- [ ] No documented mapping from an Aplos expense line to the specific grant budget line
      it draws against (`Aplos/questions-and-decisions.md` asks this generally; grant
      reporting needs it explicitly).
- [ ] Required approval and proof-of-payment evidence per grant is undefined.
- [ ] Submission format, deadlines, and correction process per funder/grant are
      undefined.
- [ ] Review and sign-off responsibilities for a grant invoice are undefined.

### What has to change in the current process

- [ ] Move from ad hoc expense review to a defined eligibility check per grant (budget
      category, period, approval status) before an expense is considered
      reimbursement-ready — today this lives only in Chip's manual review.
- [ ] Establish a consistent link between each expense and its supporting evidence
      (receipt, invoice, proof of payment) so an itemized invoice can be assembled without
      re-collecting documents — same completeness problem the monthly close workflow has,
      but grant reporting needs it at the individual expense-line level, not just
      close-period level.
- [ ] Define a review queue for grant-funded expenses specifically (already flagged as a
      category in `Aplos/monthly-close.md` §4 — "grant-funded expenses needing approval,"
      "restricted-fund items that require verification") rather than mixing grant items
      into the general close exception list.
- [ ] Decide whether grant reimbursement invoices are drafted by the system for Chip's
      approval (matching the reporting automation pattern in §Financial reporting of
      `finance-workflows-and-automation.md`) or remain fully manual until trust is
      established — this repo currently assumes deferral (Phase 4).
- [ ] Confirm this stays entirely read-only/draft-only: no automatic submission to a
      funder without explicit human approval, consistent with the read-first operating
      principle in `CLAUDE.md`.

### Sequencing

Per the action plan's Phase 4 (deferred workflows): grant reimbursement support is
explicitly sequenced *after* Phase 1–3 (visibility/reminders, review assistance,
reporting) are trusted, and after the dedicated grants discovery session — not before.

## Open owners

- Finance/accounting leadership and program/grant owners: eligibility rules, approval
  chains, which review list is authoritative.
- Ellie: budgeting dashboard data model, access terms, forecast cadence.
- Chip: month-end deadline definition, mandatory-field list, grant documentation
  practices today.
- Technical implementation owner: MCP read scope for the dashboard, join-key
  normalization between Aplos/Ramp/dashboard/grant data.
