# Finance Workflows and Automation

## Monthly close

### Current state

Chip waits five to six days after month end for transactions to settle, then works through a recurring checklist:

1. Cardholders enter account codes in Ramp.
2. Chip assigns fund codes.
3. Leonilla uploads a Ramp export to Aplos.
4. Chip cleans up the Wells Fargo bank integration in Aplos.
5. Chip reconciles the Wells Fargo brokerage account. This is legally required and should remain a controlled human step unless requirements change.
6. Chip downloads and sends bank statements, healthcare and dental invoices, the Rapid Card statement, and Gusto payroll to Leonilla.
7. Leonilla processes benefit providers and payroll integrations.
8. Chip performs a final quality pass for miscoded transactions.

The largest bottleneck is chasing the same cardholders each month for uncoded Ramp transactions and missing receipts.

### Proposed first automations

| Workflow | Timing | Inputs | Output | Human control |
|---|---|---|---|---|
| Cardholder completeness reminders | Five days before month end or the confirmed close deadline | Open Ramp transactions, missing account/fund codes, missing receipts, cardholder identity | Individual Slack reminder listing only that person's missing items | Cardholders correct their own records; delivery and completion are logged. |
| Chip close summary | Approximately seven days after month end | Unresolved Ramp items, Aplos import status, bank-feed exceptions, missing documents, checklist state | Summary of outstanding tasks and transactions with source links | Chip triages, approves, and closes exceptions. |
| Pre-quality check | After coding and invoice/receipt availability | Transaction, account, fund, payee, amount, invoice/receipt, historical patterns | Ranked flags for likely miscoding or missing support | Chip reviews every flagged item and decides whether to correct it. |

### Quality-check design

Claude may be able to identify approximately 95% of likely miscoding by comparing coded transactions with invoices and receipts. This is an estimate to validate, not an acceptance guarantee.

The first version should:

- Explain the reason for each flag.
- Show the source records used as evidence.
- Distinguish high-confidence mismatches from unusual-but-plausible transactions.
- Avoid changing Aplos or Ramp records automatically.
- Capture Chip's disposition so precision and false-positive rates can be measured over time.

## Financial reporting

Chip currently creates tailored monthly reports manually for Christian Kunkel, Dannyelle Austin, and other stakeholders. He uses a Claude project with templates and downloads from Aplos. The identified report views are:

- Total
- Launchpad
- LIN
- Philly
- Allentown
- Network

### Target workflow

1. Detect that the month is finalized and required source data is fresh.
2. Retrieve approved Aplos actuals and relevant budgeting-dashboard data.
3. Apply a stakeholder-specific report definition and access filter.
4. Generate the report with source period, assumptions, and freshness metadata.
5. Run validation checks for totals, fund coverage, and unexpected omissions.
6. Route the report for approval or distribute it to the approved recipient.
7. Store the generated artifact and an audit record.

Automation should begin with draft generation and Chip approval before fully automatic distribution.

## Government grant reimbursement

Some government grants require a monthly reimbursement invoice with proof that every expense was budgeted, approved, and eligible. The current process is entirely manual and includes reviewing expenses, checking the grant budget, building an itemized invoice, and submitting it.

This workflow was not covered in enough depth to implement responsibly. The follow-up discovery session should map:

- Grant-specific eligibility rules and budget categories.
- Required approval and proof-of-payment evidence.
- Submission format, deadlines, and correction process.
- Whether each source record can be linked to an expense line.
- Review and sign-off responsibilities.

## Annual audit

An outside firm audits actuals before the November 15 IRS 990 filing. Auditors may request receipts, invoices, proof of payment, contracts, and other support for every expense. Chip recently spent 18-hour days catching up documentation.

A clean monthly close should reduce audit burden. Saving bank statements monthly is already one useful control. Future audit support should focus on:

- Monthly evidence completeness reports.
- Source links for each expense and payment.
- A retained close package by period.
- Exception history and reviewer decisions.
- A controlled export for auditor requests.

## Actuals, budgets, and projections

Building 21 continuously re-forecasts rather than relying only on a static annual budget. Chip compares actuals to budget during the July-June fiscal year and projects three months forward, year end, and the following year.

Ellie's budgeting dashboard is separate, complex, and currently out of scope for detailed implementation. The target capability is to monitor activity, compare actuals with projections, forecast from historical data, and convert findings into clear action steps. A dedicated follow-up should define the dashboard's data model, forecast versions, update cadence, and ownership before integration work begins.

## Delivery phases

### Phase 1: visibility and reminders

- Obtain the close checklist and source artifacts.
- Connect read-only Ramp and Aplos data.
- Define open-transaction and missing-receipt states.
- Send cardholder reminders and Chip's exception summary.

### Phase 2: review assistance

- Add invoice and receipt retrieval.
- Produce explainable pre-quality-check flags.
- Record Chip's decisions and measure results.
- Add close-package completeness tracking for audit readiness.

### Phase 3: reporting

- Define stakeholder report templates and recipient permissions.
- Join finalized Aplos actuals to approved budgeting-dashboard data.
- Generate draft reports, validate totals, and route for approval.

### Phase 4: deferred workflows

- Design government grant reimbursement support.
- Integrate projections and forecasting after the dedicated discovery session.
- Reassess whether any write actions are justified only after controls, approvals, and auditability are proven.
