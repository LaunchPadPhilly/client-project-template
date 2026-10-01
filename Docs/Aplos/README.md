# Aplos documentation

This folder captures the operational and implementation knowledge needed to connect Aplos to the finance MCP and support Claude-driven review workflows.

## Documents

- [Workflow.md](Workflow.md) — product vision and high-level scope.
- [data-model.md](data-model.md) — the data entities and fields that must be available from Aplos.
- [integration-spec.md](integration-spec.md) — the read-only MCP integration contract, tool design, and safety boundaries.
- [monthly-close.md](monthly-close.md) — monthly-close checks, exception logic, and review-queue behavior.
- [questions-and-decisions.md](questions-and-decisions.md) — unresolved decisions and the questions the finance team must answer before build-out.

## Working assumptions

- The finance workflow is read-first by default.
- Claude may read, analyze, summarize, and recommend; it should not post or modify accounting records without explicit approval.
- The system should produce a human review queue for items that need judgment, approval, or follow-up.
- The initial focus is financial visibility, exception detection, and workflow support rather than automated ledger changes.

## Implementation priority

1. Confirm the Aplos data model and access points.
2. Confirm read-only scope and approval boundaries.
3. Build the MCP tools for budgets, transactions, and review items.
4. Add monthly-close exception detection and a review queue.
5. Add Ramp enrichment when a connector is approved.

## Decision gate

Before any implementation beyond read-only access, the team should answer:

- What Aplos objects are available through the API or export layer?
- What is considered a review item?
- What monthly-close tasks are mandatory?
- What changes require human approval?
- Which objects are source-of-truth, and which are derived summaries?
