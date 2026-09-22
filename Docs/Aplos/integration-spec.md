# Aplos MCP integration specification

This document defines the initial read-only integration pattern between Aplos and the finance MCP.

## Integration model

The integration should follow a simple pattern:

Aplos source data → finance MCP tools → Claude analysis → finance review queue / human approval

## Design principles

- read-only by default
- parameterized queries and validation
- explicit scope boundaries
- no direct accounting writes without approval
- result summaries that can be audited and traced back to source records

## MCP tool categories

### 1. Financial lookup tools

These tools answer direct finance questions.

Examples:

- get_transactions
- get_expenses_by_period
- get_spend_by_category
- get_budget_vs_actual
- get_historical_trends
- get_account_activity

### 2. Exception and review tools

These tools identify items that need finance review.

Examples:

- get_uncategorized_transactions
- get_missing_information_items
- get_pending_review_items
- get_month_end_exception_summary
- get_variance_alerts

### 3. Review queue tools

These tools help structure the approval flow.

Examples:

- get_review_queue
- get_review_queue_by_owner
- get_review_item_detail
- get_exception_summary_by_category

## Tool contract expectations

Every tool should return:

- a well-defined scope of records
- a filter or date-range description
- counts and totals where relevant
- a list of records or summarized groups
- a source reference for traceability
- a clear explanation of any missing or incomplete data

## Safety requirements

- Tools must validate all parameters before querying data.
- No write operations should be exposed in the initial workflow.
- Any derived summary must be explainable in plain language.
- Any missing or ambiguous data should be surfaced to the user rather than silently omitted.
- Financial recommendations must separate analysis from approval.

## Suggested first-pass scope

The best first version is a minimal but useful finance review layer.

### Must-have tools

- get_transactions
- get_budget_vs_actual
- get_uncategorized_transactions
- get_review_queue
- get_month_end_exception_summary

### Nice-to-have tools

- get_forecast_summary
- get_grant_related_exceptions
- get_vendor_review_items
- get_trend_summary

## Output format

Responses should be structured enough for Claude to reason over and for finance teams to review.

Example response elements:

- period
- account or category
- amount
- count
- variance
- issue type
- urgency
- recommended action
- owner or queue target

## Success criteria

The integration is successful when the finance team can:

- ask questions in natural language and get grounded answers
- quickly identify month-end exceptions
- review a queue of unresolved items
- understand why an item was flagged
- confirm that no accounting changes happened without approval
