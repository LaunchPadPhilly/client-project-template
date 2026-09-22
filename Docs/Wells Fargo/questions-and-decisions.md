# Wells Fargo questions and decisions

This document records the open questions that need answers before implementation and the decisions that should be locked down early.

## Required questions

1. What Wells Fargo data is available through the approved access method?
2. Which account categories or departments are in scope?
3. Do we need account balances only, or also transaction history and transfer data?
4. What is the expected frequency of reconciliation and cash monitoring?
5. What counts as an exception or unusual transaction?
6. What are the standard internal controls for reconciling bank activity?
7. What data is required to map bank activity back to internal projects, departments, or funds?
8. Does the organization want summaries only, or also item-level anomaly review?
9. What approvals are required before a cash issue is treated as actionable?
10. What is the minimum data retention and audit-log requirement for review items?

## Working decisions

- Start with read-only access.
- Treat Wells Fargo as a source system, not an approval authority.
- Keep reconciliation and exception review under finance ownership.
- Use Claude for summarization and issue detection, not for automated bank actions.
- Focus first on balances, recent activity, and variance review before deeper automation.

## Decision owners

The following stakeholders should answer the questions above:

- finance leadership
- accounting or reconciliation staff
- the bank access / system owner
- technical implementation owner
- any grant or project manager whose data needs to be mapped

## Recommended next step

The team should hold a working session with finance and banking stakeholders to lock down the available data, the required fields, and the exception thresholds. Once those are defined, the MCP tools and review queue can be implemented with much lower risk.
