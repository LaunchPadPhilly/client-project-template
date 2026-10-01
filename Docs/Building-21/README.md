# Building 21 Finance Documentation

This folder captures the finance discovery session and turns it into an executable research and delivery backlog.

## Documents

- [Action plan](building-21-finance-action-plan.md) — owners, sequencing, dependencies, and immediate follow-ups.
- [Discovery interview guide](discovery-interview-guide.md) — preparation standards, required questions, and interview habits.
- [Systems and MCP architecture](building-21-systems-and-mcp.md) — organizational boundary, source systems, proposed Building 21 MCP, and access needs.
- [Finance workflows and automation](finance-workflows-and-automation.md) — current-state workflows, automation opportunities, and phased delivery plan.
- [Central data, close and grant checklist](central-data-close-grant-checklist.md) — the central data sheet, monthly close, and grant reporting steps.
- [Connector credentials checklist](connector-credentials.md) — what Aplos, Ramp, Gusto, Green Dot and Wells Fargo each need for access, and status.
- [AWS Setup (reference)](../../AWS%20Setup/README.md) — AWS phase guides copied from another project, mapped onto this repo's Terraform and plays.

## Working assumptions

- Building 21 is the parent organization; Launchpad is one initiative within it.
- The existing Launchpad MCP remains Launchpad-scoped.
- The proposed Building 21 MCP is a separate service and includes Launchpad as a subset.
- Any automation touching financial records should begin read-only and preserve Chip's approval and review responsibilities.
- Government grants workflow and projections/forecasting are intentionally deferred for a follow-up session.

## Status legend

- **Now** — can be started with the information already available.
- **Needs access** — blocked until a person, system, credential, or artifact is provided.
- **Research** — requires a product/API or process investigation before implementation.
- **Follow-up** — intentionally deferred to a dedicated conversation.
