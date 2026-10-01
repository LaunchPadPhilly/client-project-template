# AWS Setup (reference)

These phase guides were copied from the LP Internal AI V1 project as background for
standing up AWS. They describe **that** project's manual AWS CLI setup, its resource
names, and its pnpm-workspace packages (`@lp-ai/*`). **Do not run their commands against
this repository.**

This repository builds AWS with Terraform in [`infra/`](../infra/README.md), following the
plays in [`playbook/`](../playbook/README.md). Where a guide here disagrees with
those, the Terraform and the plays are authoritative.

## Phase map

| Phase | Guide | This repo's equivalent | Lesson that carries over |
|---|---|---|---|
| 0 | [Project bootstrap](00-project-bootstrap.md) | Plays [01](../playbook/01-preflight.md), [02](../playbook/02-template-init.md), [04](../playbook/04-local-development.md) | Fill env values incrementally; local values go only in ignored `.env.local` |
| 1 | [AWS account + IAM baseline](01-aws-baseline.md) | Plays [05](../playbook/05-aws-account-prereqs.md), [06](../playbook/06-terraform-bootstrap-global.md) | The ECS task role is separate from the execution role |
| 2 | [RDS Postgres + pgvector](02-rds-postgres.md) | Play [08](../playbook/08-uat-bringup.md); `infra/modules/environment/database.tf` | Decide on encryption and deletion protection at creation; least-privilege app user |
| 3 | [Secrets Manager](03-secrets-manager.md) | Play [09](../playbook/09-uat-secret.md); `web_secret_keys` / `mcp_secret_keys` | The operator needs `PutSecretValue`; here it is one flat JSON secret per environment |
| 4 | [Prisma schema](04-prisma-schema.md) | `prisma/schema.prisma`, `database-change` skill, Play [10](../playbook/10-uat-activation.md) | `CREATE EXTENSION vector` must be possible before a pgvector migration |
| 5 | [Google connectors](05-google-connectors.md) | None yet; connectors go under `src/lib/server/<connector>/` | Share every Sheet and Drive folder with the service account explicitly |

The source project's Phase 6 (embeddings) was not copied.

## Known content to scrub before reuse

These guides still contain identifiers from the source project: an IAM username in the
example ARN in Phase 1, and a Google service account email and client ID in Phase 5.
`pnpm run template:check` flags them. Replace them with placeholders before you adapt any
part of a guide for this repository.
