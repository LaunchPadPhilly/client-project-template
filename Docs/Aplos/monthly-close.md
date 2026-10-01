# Monthly close and review workflow

This document translates the Aplos finance workflow into a concrete review process for close-related exceptions.

## Primary goal

Use Aplos data to identify financial items that need attention before month-end close is complete.

## Review categories

The system should inspect the following categories of data.

### 1. Uncategorized or incomplete transactions

Examples:

- transactions without a category
- transactions without a vendor
- transactions missing a memo or reference
- transactions missing a department or project assignment

### 2. Budget and forecast variance

Examples:

- actual spending beyond budget
- unusual period-over-period changes
- forecast risks that need management attention

### 3. Reconciliation exceptions

Examples:

- expected vs. actual mismatch
- duplicate or split entries
- missing supporting data
- items waiting on finance review

### 4. Grant or project review items

Examples:

- grant-funded expenses needing approval
- project costs missing documentation
- restricted-fund items that require verification

## Suggested monthly-close checks

The workflow should evaluate each open period for:

- uncategorized transactions
- unassigned transactions
- missing required information
- review queue items
- account variances
- high-value exceptions
- grant-related anomalies
- items still incomplete at close deadline

## Review queue behavior

Each flagged item should carry:

- issue type
- transaction or account reference
- amount
- date
- category or account
- owner or queue target
- urgency or risk rating
- recommended action
- open/closed status

The queue should allow the finance team to review items in a structured way before the close is marked complete.

## Example close summary

A close summary could look like this:

- 14 transactions require categorization
- 5 items need more information
- $3,240 in expenses remain unreviewed
- 3 items are associated with grant activity
- 2 items need finance review before close

## Human approval requirement

The review queue should not itself close the books. It is a decision-support layer.

The actual accounting decision must remain with the finance team. The system should provide structure, not authority.

## MVP close checklist

The first pass should include:

- identify uncategorized transactions
- identify transactions missing mandatory fields
- compare actual vs. budget for the period
- list review items by category or owner
- generate a summary for monthly close
- keep the review list auditable

## Next decisions

The team should decide:

- which issues are automatically flagged vs. manually reviewed
- what thresholds trigger escalations
- which fields are considered mandatory before close
- which review list is the official source of truth for close work
