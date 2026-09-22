# Aplos data model

This document summarizes the data needed for the finance workflow and the fields that should be available to the MCP layer.

## Required data areas

### 1. Transactions

The system needs transaction-level visibility to answer spend questions and detect exceptions.

Required fields may include:

- transaction id
- date
- posted date
- amount
- currency
- vendor or payee
- account or category
- department or cost center
- project, grant, or program reference
- memo or description
- status (posted, pending, uncategorized, etc.)
- source system reference

### 2. Chart of accounts / categories

Finance users need to compare actuals to budget and classify spend by category.

Required fields may include:

- account id
- account name
- parent account or category
- account type
- active/inactive status
- department or ownership

### 3. Budget and forecast data

The workflow needs actual vs. budget comparison and trend support.

Required fields may include:

- budget period
- account or category
- budget amount
- forecast amount
- actual amount
- variance amount
- variance percent

### 4. Period close / review state

Monthly close tooling needs to know when data is complete, pending, or flagged for review.

Relevant fields may include:

- fiscal period
- close status
- approval status
- review required flag
- pending items count
- exception count

### 5. Vendors and payees

Important for uncategorized-item review and missing-information detection.

Relevant fields may include:

- vendor id
- vendor name
- vendor type
- associated account or category
- active status

### 6. Grants / programs / funding sources

If grant tracking is required, the workflow should know how expenses are associated with projects or restricted funding.

Relevant fields may include:

- grant id
- grant name
- program name
- funding source
- restricted/unrestricted designation
- associated expense lines

## Data quality requirements

Before tooling is built, the team should confirm:

- whether Aplos exposes these fields directly through API or export
- whether some values are derived in reporting instead of stored in the system
- whether categories and accounts are standardized across periods
- whether duplicate or partially matched vendor records exist

## Derived values

The MCP should be able to compute values like:

- month-to-date spend
- year-to-date spend
- variance vs. budget
- transactions awaiting review
- uncategorized transaction count
- grant-related exception count

The system should store or log the source of every derived value so the finance team can audit the result.
