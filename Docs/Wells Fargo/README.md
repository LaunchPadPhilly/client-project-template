# Wells Fargo documentation

This folder captures the source-system knowledge required to connect Wells Fargo banking and cash activity into the finance MCP for review, reconciliation, and exception checking.

## Documents

- [workflow.md](workflow.md) — product and operational purpose.
- [data-model.md](data-model.md) — account, transaction, and cash-management data that should be available.
- [integration-spec.md](integration-spec.md) — read-only connector pattern and MCP contract.
- [cash-operations.md](cash-operations.md) — account balances, cash movement, and exception workflow.
- [questions-and-decisions.md](questions-and-decisions.md) — open questions and required decisions before implementation.

## Working assumptions

- Wells Fargo is treated as a source system, not the system of record for accounting policy.
- The workflow is read-first and should support reconciliation rather than direct ledger changes.
- The finance team needs visibility into balances, transfers, and transaction activity for cash forecasting and close support.
- Any data used by Claude should be traceable back to an account, statement, or transaction source.

## Implementation priority

1. Confirm available Wells Fargo account and transaction data.
2. Define the safe read-only access model.
3. Build account and transaction lookup tools.
4. Add cash-position and reconciliation checks.
5. Connect exceptions and review queues to the broader finance workflow.

## Key business goals

- understand cash position by account and date
- compare bank activity against expected cash movement
- identify pending or unusual transactions
- support month-end and close reconciliation
- surface missing or anomalous banking activity before it becomes a finance issue
