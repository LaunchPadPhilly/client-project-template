# Building 21 Finance MCP — Financial Transaction Management & Reminders

**Purpose.** Create a workflow that uses Ramp transaction data to organize financial activity, classify and route transactions, identify items requiring review, and automate reminders for missing receipts, coding, approvals, or other requirements.

## 1. Financial Transaction Classification & Routing

The system will connect to Ramp through its API and evaluate transaction information alongside Ramp's suggested accounting classifications and Building 21's financial rules.

- Pull new or relevant transactions from Ramp.
- Read Ramp's suggested coding/classification.
- Compare the suggestion against the Building 21 Chart of Accounts, funds, vendors, departments, and established coding rules.
- Filter transactions based on defined criteria such as amount, account, fund, vendor, missing information, or grant relevance.
- Automatically classify transactions when they match established rules.
- Route ambiguous, unusual, or high-value transactions to the appropriate person or team.
- Provide links or source references back to the relevant Ramp transaction where available.
- Record the classification, routing decision, and approval status for an audit trail.

## 2. Example Routing Rules

| Condition | Action | Destination |
|---|---|---|
| Known software vendor | Apply established coding rule | Technology / Finance |
| Program-related expense | Flag or route | Program Team |
| Grant-related expense | Require review | Grant / Finance Team |
| Unknown vendor or coding | Flag for review | Finance |
| High-value transaction | Require approval | Finance |

## 3. Credit-Card & Financial Reminders

The workflow can complement Ramp's existing reminder functionality by providing Building 21-specific monitoring, escalation, and reporting. The goal is not to duplicate basic Ramp reminders, but to identify outstanding financial tasks at the organization level.

| Condition | Automated Action |
|---|---|
| Missing receipt | Remind the cardholder to provide the required documentation. |
| Missing coding | Notify the cardholder or responsible person. |
| Outstanding item | Send a follow-up after a defined period. |
| Repeatedly overdue item | Escalate to the appropriate manager or Finance. |
| High-value unresolved transaction | Send directly to Finance for review. |
| Grant-related unresolved expense | Route to the grant/Finance team. |
| Month-end approaching | Send a summary of remaining outstanding items. |

## 4. Example Daily Finance Check

```
Ramp transactions
  ↓
Finance MCP evaluates transaction status
  ↓
Check coding, receipts, account, fund, amount, and assignment
  ↓
Classify / filter / route
  ↓
Send reminders or escalation when required
  ↓
Human review and approval
  ↓
Prepare or pass approved information into the accounting workflow
```

## 5. Human Approval & Controls

The system should not automatically approve every financial transaction. A safer initial workflow is to use Ramp suggestions and established rules for classification and routing, while requiring human approval for exceptions, ambiguous transactions, and other defined high-risk or high-value actions.

- Maintain an audit trail of classifications and changes.
- Separate automated classification from financial approval.
- Define thresholds that always require Finance review.
- Keep Building 21 and Launchpad data boundaries clear.
- Start with read/review capabilities before introducing write actions.

## 6. MVP Scope

- Ramp API connection and secure authentication.
- Transaction retrieval.
- Access to Ramp's suggested coding information where available.
- Building 21 Chart of Accounts and Fund List integration.
- Rule-based filtering and routing.
- Outstanding receipt/coding detection.
- Automated reminders and escalation.
- Finance review queue.
- Transaction/source links where available.
- Basic audit/history logging.

## 7. Next Steps

- Confirm what Ramp transaction, receipt, accounting, user, fund, department, and webhook data is available through the API.
- Obtain the Building 21 Chart of Accounts and Fund List.
- Define the first set of classification and routing rules.
- Define reminder timing and escalation rules.
- Identify which transactions always require human approval.
- Prototype the Ramp → Finance MCP → review/reminder workflow.
- Test the workflow with real or representative transactions before connecting any write operations to accounting systems.

## Connection to the Discovery Findings

This feature directly addresses the monthly-close workflow discussed during discovery. The goal is to reduce manual review and follow-up while making important financial information easier to organize and act on. The transcript also identified the need to understand the Chart of Accounts, Funds, Ramp, Aplos, Wells Fargo, and Gusto before determining the final automation scope.
