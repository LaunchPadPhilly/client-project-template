# Wells Fargo data model

This document describes the data needed for a Wells Fargo finance workflow and the fields that should be exposed to the finance MCP.

## Required data areas

### 1. Accounts

The workflow should understand each bank account and its current status.

Relevant fields may include:

- account id
- account name
- account nickname
- account type
- routing and account identifiers
- status
- currency
- ownership or department
- associated program or fund

### 2. Transactions

Transaction activity is the core of the integration.

Relevant fields may include:

- transaction id
- account id
- posting date
- transaction date
- amount
- currency
- description
- payee or counterparty
- type (debit, credit, transfer, ACH, wire, etc.)
- check number or reference, if applicable
- category or classification
- status (posted, pending, rejected, etc.)

### 3. Cash movement and balances

Used for daily cash position and closing support.

Relevant fields may include:

- current balance
- available balance
- opening balance
- closing balance
- net movement
- period start and end date
- incoming vs outgoing totals

### 4. Transfer and payment activity

Important for cash planning and reconciliation.

Relevant fields may include:

- transfer id
- source account
- destination account
- amount
- date
- reference
- approval or processing status

### 5. Reconciliation data

The finance team needs to compare bank activity against internal expectations.

Relevant fields may include:

- expected inflow/outflow
- matched transaction flag
- unmatched transaction flag
- reconciliation status
- exception reason
- review queue reference

### 6. Program, project, or department mapping

When required, bank activity should be linkable to internal team or program structures.

Relevant fields may include:

- project id
- grant id
- department id
- cost center
- internal reference

## Data quality requirements

Before implementation, the team should confirm:

- what fields are available through API or export
- whether some data is only available in periodic statement exports
- whether transaction descriptions are standardized enough for classification
- whether duplicate records or partial postings are possible
- which fields are required for reconciliation and review

## Derived values

The MCP should be able to compute:

- net cash movement by account
- period balance changes
- unmatched transactions count
- high-risk exceptions
- variance between expected and actual cash
- pending review items

Any derived value should be explainable and traceable to source records.
