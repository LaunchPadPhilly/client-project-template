# Building 21 Systems and MCP Architecture

## Organizational boundary

Building 21 is the parent organization of Launchpad. Staff, including Christian Kunkel, are legally Building 21 employees. Building 21 is responsible for IRS financial reporting, while Launchpad appears as one initiative among several.

The existing Launchpad MCP was scoped to Launchpad data. The agreed direction is to build a separate Building 21-wide MCP that includes Launchpad as a subset. Keeping the services separate now also prepares for a possible future legal or operational split between the entities.

## Source systems

| System | Current role | Important data |
|---|---|---|
| Ramp | Credit card platform for approximately 15 staff | Card transactions, account coding, fund coding, payees, receipts, cardholder status, and AI-oriented automation features. |
| Aplos | Accounting system | General ledger, chart of accounts, posted transactions, fund accounting, and financial reports. Ramp exports are uploaded by bookkeeper Leonilla. |
| Wells Fargo | Main bank | Bank transactions and statements; the bank feed currently reaches Aplos automatically. |
| Gusto | Payroll for full-time employees | Payroll and benefits data; direct integration into Aplos. Contractors have moved to Ramp. |
| PEX / Rapid Card | Additional card and incentive systems | Data currently tracked through Google Sheet exports pulled into the MCP. |
| Ellie's budgeting dashboard | Internal budgeting and forecasting system | Budgets, projections, forecast views, and comparisons to actuals. Read access is needed. |
| Slack | Team communication and notification channel | Close reminders, summaries, artifact sharing, and approved report distribution. |

## Proposed Building 21 MCP

The service should provide a read-oriented interface across Building 21 financial systems. Initial capabilities should include:

- Retrieve Ramp transactions needing coding, receipts, or review.
- Retrieve Aplos accounts, funds, transactions, and finalized reports.
- Retrieve Wells Fargo or Aplos bank-feed status once the connectivity approach is known.
- Retrieve PEX / Rapid Card data from the existing sheet-based path.
- Retrieve approved read-only budgeting and forecast data.
- Link records back to their source system and preserve source timestamps.
- Produce exception lists and report inputs for downstream workflows.

Launchpad data should be exposed as a scoped subset, not by merging the Launchpad MCP's identity, credentials, deployment, or authorization boundary into the new service.

## Security and operating principles

- Start read-only. No MCP tool should create, update, delete, or post financial records in the first phase.
- Keep connector credentials server-side and separate from browser-reachable code.
- Apply explicit scopes for Building 21 financial domains and audit every access.
- Limit Slack notifications and reports to approved recipients and minimum necessary data.
- Preserve source IDs, source URLs, retrieval time, and data freshness in normalized records.
- Redact or restrict invoices, receipts, payroll details, and other sensitive data before model processing where appropriate.
- Treat AI findings as review queues. Chip remains the accountable reviewer unless a later control decision says otherwise.

## Access and discovery checklist

- [ ] Building 21 legal/entity and initiative identifiers confirmed.
- [ ] Ramp API availability, authentication, rate limits, webhooks, export behavior, and automation features researched.
- [ ] Aplos API credentials, endpoints, supported objects, and existing Launchpad integration reviewed.
- [ ] Wells Fargo API, Plaid, or another bank-feed approach evaluated for required history and reconciliation data.
- [ ] Ellie's dashboard platform, workbook structure, permissions, and read-only integration path confirmed.
- [ ] Slack workspace, channels, bot identity, retention, and recipient rules confirmed.
- [ ] Data classification and AI-processing policy agreed for financial documents.
- [ ] Owners named for deployment, data stewardship, and user-facing workflows.

## Suggested implementation boundary

1. **Connectors:** source-specific clients for Ramp, Aplos, bank data, budgeting data, and sheet exports.
2. **Normalization:** stable internal representations for transaction, account, fund, payee, receipt, invoice, and report period.
3. **MCP tools:** read-only, validated tools over normalized data with explicit scopes.
4. **Workflow jobs:** scheduled reminders, summaries, quality checks, and report generation.
5. **Delivery:** Slack and approved report destinations with audit records.

This separation keeps source integration, financial interpretation, MCP access, and notification delivery independently testable.
