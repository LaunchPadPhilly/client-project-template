# Connector Credentials Checklist

What each external finance system needs before its connector can be built, who grants
access, and where it stands. **This file tracks status only. Never put credential values
here.**

## Rules

- Connector credentials load server-side only. They never go in browser-reachable code or
  in `PUBLIC_*` variables (see [SECURITY.md](../../SECURITY.md)).
- Request **read-only** access everywhere. MCP tools are read-only, so the credentials
  behind them should be too.
- Values live only in ignored `.env.local` (local) and in the environment secret
  (`uat/<slug>/app`, `prod/<slug>/app`). Never put them in Slack, tickets or this file.
- The env names below are **proposed**. When a connector is actually built, add its keys to
  `.env.example` *and* to `web_secret_keys` / `mcp_secret_keys` in the environment root's
  `variables.tf`, or ECS never injects them.
- Connector code lives under `src/lib/server/<connector>/`.

## Status

| System | Data it provides | Access method | Credentials needed (proposed env names) | Access owner / grantor | Status |
|---|---|---|---|---|---|
| Aplos | Fund accounting, general ledger, funds | API key | `APLOS_API_ID`, `APLOS_API_KEY` | Finance | ✅ Done |
| Ramp | Card transactions, reimbursements, bills | OAuth 2.0 client credentials, read scopes | `RAMP_CLIENT_ID`, `RAMP_CLIENT_SECRET` | Finance / Ramp admin | ✅ Done |
| Gusto | Payroll runs, employees, compensation | ⚠️ **Not the Gusto API** (partner-only). Use the Gusto CLI or Gusto MCP server, see [Gusto](#gusto) | TBD once the CLI vs. MCP route is chosen | Gusto admin (HR / Finance) | ⬜ Not started |
| Green Dot | Prepaid / stipend card disbursements | *Confirm:* API access vs. portal CSV export | TBD once access method is confirmed | Finance | ⬜ Not started |
| Wells Fargo | Bank transactions, balances | *Confirm:* API enrollment vs. statement / BAI2 / CSV export | TBD once access method is confirmed | Finance / bank admin | ⬜ Not started |

## Per-system checklist

### Aplos ✅

- [x] Admin contact identified
- [x] Read-only API access granted
- [ ] Credentials stored in `.env.local` and the UAT secret
- [ ] Keys added to `.env.example` and the secret key lists (when the connector is built)
- [ ] Connector at `src/lib/server/aplos/`

### Ramp ✅

- [x] Admin contact identified
- [x] Read-only API access granted (read scopes only)
- [ ] Credentials stored in `.env.local` and the UAT secret
- [ ] Keys added to `.env.example` and the secret key lists (when the connector is built)
- [ ] Connector at `src/lib/server/ramp/`

### Gusto

> **Access restriction (from Gusto's developer docs):** The Gusto API is restricted to
> Gusto App Integration and Embedded Payroll partners. A Gusto *customer* connecting its own
> company systems to its own Gusto account is explicitly listed as **not supported** for API
> access. Gusto says customers should use the **Gusto CLI** or the **Gusto MCP server**
> instead.
>
> Production API access also requires an approved Production Pre-Approval and Security
> Review, which is "not a formality" and not guaranteed. Gusto recommends getting approval
> before building.

We are a Gusto customer, not a software partner, so the standard OAuth developer-app path
does not apply. Do not build against the Gusto API.

- [ ] Gusto admin contact identified
- [ ] Choose the route: Gusto CLI (scheduled export into our store) or Gusto MCP server (connected alongside ours)
- [ ] Confirm the chosen route can be limited to read-only access
- [ ] Confirm what credential or login the chosen route needs, and who holds it
- [ ] Credential names decided and the status table updated
- [ ] Credentials stored in `.env.local` and the UAT secret (if the route needs a server-side credential)
- [ ] Keys added to `.env.example` and the secret key lists (if applicable)
- [ ] Connector at `src/lib/server/gusto/` (CLI/export route only)

### Green Dot

- [ ] Account / admin contact identified
- [ ] Access method confirmed (API or scheduled export)
- [ ] Read-only access granted
- [ ] Credential names decided and this table updated
- [ ] Credentials stored in `.env.local` and the UAT secret
- [ ] Keys added to `.env.example` and the secret key lists
- [ ] Connector at `src/lib/server/greendot/`

### Wells Fargo

- [ ] Bank admin contact identified
- [ ] Access method confirmed (API enrollment or scheduled export)
- [ ] Read-only access granted
- [ ] Credential names decided and this table updated
- [ ] Credentials stored in `.env.local` and the UAT secret
- [ ] Keys added to `.env.example` and the secret key lists
- [ ] Connector at `src/lib/server/wellsfargo/`
