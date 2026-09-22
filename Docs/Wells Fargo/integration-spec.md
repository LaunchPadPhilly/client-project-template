# Wells Fargo MCP integration specification

This document defines the initial read-only integration pattern for Wells Fargo data within the finance MCP.

## Integration model

Wells Fargo source activity → finance MCP tools → Claude analysis → finance review queue

## Design principles

- read-only by default
- explicit validation of all filters and dates
- no direct bank-side actions in the initial workflow
- clear distinction between bank activity and accounting approval
- traceability from summary to underlying transactions

## MCP tool categories

### 1. Account and balance tools

Examples:

- get_accounts
- get_account_balance
- get_account_activity
- get_account_summary

### 2. Transaction and cash tools

Examples:

- get_transactions
- get_transaction_detail
- get_cash_movement
- get_recent_activity
- get_period_balance_summary

### 3. Exception and review tools

Examples:

- get_unmatched_transactions
- get_cash_variance_alerts
- get_pending_review_items
- get_unusual_activity
- get_reconciliation_summary

### 4. Review queue tools

Examples:

- get_review_queue
- get_review_item_detail
- get_exception_by_account
- get_exception_by_type

## Tool contract expectations

Each tool should return:

- the account or date range queried
- the transaction or balance set requested
- counts and totals where relevant
- exception or reconciliation notes
- source references for traceability
- any data incompleteness or missing fields

## Safety requirements

- no write or transfer functions in the first phase
- all account and date filters must be validated
- transaction results should be reviewable by finance staff
- suspicious anomaly outputs should surface the reason and supporting data
- no secrets or bank credentials should be exposed in logs or responses

## First-phase scope

The minimum viable connector should include:

- account lookup
- balance lookup
- transaction list retrieval
- period summary
- variance and exception review
- review queue generation

## Success criteria

The banking connector is considered successful when finance staff can:

- view current cash position by account
- review recent transaction activity
- identify exceptions or mismatches
- understand the source of a flagged item
- route unreconciled items to a human review queue without making bank-side actions automatically
