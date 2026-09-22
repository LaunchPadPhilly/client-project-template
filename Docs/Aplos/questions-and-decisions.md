# Aplos questions and decisions

This document captures the open questions that must be answered before implementation and the working decisions that should be locked in early.

## Required questions

1. What exact Aplos objects are available through the API or export layer?
2. Which objects are considered read-only source-of-truth records?
3. Are any write actions allowed for any part of the workflow?
4. What finance questions are highest priority for launch?
5. What counts as a transaction that requires human review?
6. What is the organization’s monthly-close process and milestone definitions?
7. What is the source of truth for budget and forecast data?
8. What degree of latency is acceptable for the data refresh cycle?
9. Which program or grant fields are required for review?
10. What approval and audit controls are required before any change is made?

## Working decisions

- The workflow should start read-only.
- Claude may analyze, summarize, and flag issues.
- Human finance staff should own final decisions and approval steps.
- The review queue is the safe interface between analysis and action.
- Budget, actuals, and close-state checks should be grounded in Aplos data, not assumptions.
- Ramp data can be layered into the process only after a clear matching and approval model is approved.

## Decision owners

The following groups should answer these questions:

- accounting or finance leadership
- program or grant owners
- the Aplos admin or system owner
- the technical implementation owner
- the person responsible for approval controls and audit logging

## Recommended next step

Before implementation begins, hold a short working session with finance and Aplos stakeholders to answer the questions above and document the approved scope. Only after that should the team commit to tool definitions, review rules, and automation logic.
