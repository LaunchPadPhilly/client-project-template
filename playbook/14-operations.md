# Play 14 — Operations

**Goal:** the routine and exceptional procedures a developer will need after go-live,
each with its own evidence. Run the section you need; none depend on each other.

**Needs:** Play 10 closed for UAT, Play 12 for production. Shell exports active.
Replace `uat` / `<slug>-uat` with `production` / `<slug>` for production.

## A. Release a change

1. Open a PR; `ci.yml` must pass; merge to `uat` (the deploy-trigger branch — not `main`).
2. `deploy.yml` runs: build → deploy-uat → smoke-test-uat, then stops.
3. Verify UAT in the browser (Play 11 step 2 commands for the image SHA).
4. Promote: `gh workflow run deploy-production.yml -f image_sha=<sha>`.
5. If tool definitions changed, tell anyone with a connected MCP client to reconnect; the
   server is stateless per request and cannot push the updated tool list.

**EVIDENCE 14.A** — `gh run view <id> --json conclusion,headSha` for both workflows.
**Accept when:** both `success` with the same `headSha`/`image_sha`.

## B. Roll back

Rollback is a promotion of an older SHA that is still in ECR (the lifecycle policy keeps
the last 50 images):

```bash
aws ecr describe-images --repository-name <slug>-web --query 'sort_by(imageDetails,&imagePushedAt)[-5:].{tag:imageTags[0],pushed:imagePushedAt}' --output table
gh workflow run deploy-production.yml -f image_sha=<older sha>
```

The migration step runs again and is a no-op if the schema did not change. **A rollback
across a schema migration is not automatic**: Prisma migrations do not run backwards. Plan
a forward-fix migration instead.

**EVIDENCE 14.B** — the table and the green run.

## C. Change a secret value

```bash
umask 077; F="$(mktemp /tmp/app-secret.XXXXXX)"
aws secretsmanager get-secret-value --secret-id uat/<slug>/app --query SecretString --output text > "$F"
"${EDITOR:-vi}" "$F"                          # edit; never replace the object with a partial one
jq 'keys' "$F"                                # names only
WINPATH="$(cygpath -m "$F")"                  # Git Bash on Windows only — see note below
aws secretsmanager put-secret-value --secret-id uat/<slug>/app --secret-string "file://$WINPATH" --query VersionStages && rm -f "$F"
for s in <slug>-uat-web <slug>-uat-mcp; do
  aws ecs update-service --cluster <slug>-uat-cluster --service "$s" --force-new-deployment --query 'service.serviceName' --output text
done
aws ecs wait services-stable --cluster <slug>-uat-cluster --services <slug>-uat-web <slug>-uat-mcp && echo STABLE
```

ECS resolves secrets at task start; without the forced redeploy of **both** services the
old value stays live and a green smoke test proves nothing.

**Windows/Git Bash gotcha:** `file://$F` with the raw `/tmp/...` path fails with
`Unable to load paramfile ... No such file or directory`, even though the file is right
there. The AWS CLI here is a native Windows Python executable, not an MSYS-aware one — it
never understood Git Bash's `/tmp` alias in the first place, so `MSYS_NO_PATHCONV=1` does
**not** fix this one (there was never any path translation to disable). `cygpath -m`
converts to a real Windows path (`C:/Users/.../AppData/Local/Temp/...`) that both Git
Bash and the native `aws.exe` agree on.

**EVIDENCE 14.C** — key list, `VersionStages`, `STABLE`.
**Accept when:** keys unchanged (or the intended addition, which must also be added to
`web_secret_keys`/`mcp_secret_keys` and applied), one `AWSCURRENT`, `STABLE`.

Rotating the Google client secret: create a new secret on the same client in Google Cloud,
put it here, redeploy, then delete the old one in Google Cloud. Rotating the database
password: rotate in RDS (managed), then
`./scripts/fix-secret-database-url.sh build --env uat --from-rds-secret --merge-into "$F"`
in the flow above.

## D. Repair a malformed `DATABASE_URL`

```bash
./scripts/fix-secret-database-url.sh repair uat/<slug>/app          # dry run, prints the diagnosis only
./scripts/fix-secret-database-url.sh repair uat/<slug>/app --apply
```

Then force-redeploy both services (section C). **EVIDENCE 14.D** — the dry-run diagnosis
and `STABLE`.

**`repair` only checks the string's shape (encoding, port format) — it cannot tell you the
password itself is stale.** RDS rotates a managed master password on its own schedule with
no warning, and `repair` will happily report `Already well-formed; nothing to change` on a
`DATABASE_URL` holding a password Postgres no longer accepts. The actual symptom is both
`web` and `mcp` logging the same error on completely unrelated requests:

```
PrismaClientKnownRequestError: ... Authentication failed against the database server,
the provided database credentials for `app_admin` are not valid
code: 'P1000'
```

Confirm it is a rotation (not something else) before touching the secret, by comparing the
password actually stored against RDS's current managed credential — safe to run, it only
ever prints short hashes and a boolean, never either password:

```bash
F2="$(mktemp /tmp/compare-pw.XXXXXX.js)"
cat > "$F2" <<'EOF'
const { execSync } = require('node:child_process');
const crypto = require('node:crypto');
function aws(id) { return JSON.parse(execSync(`aws secretsmanager get-secret-value --secret-id "${id}" --query SecretString --output text`).toString()); }
function hash(s) { return crypto.createHash('sha256').update(s).digest('hex').slice(0, 12); }
const appSecret = aws('uat/<slug>/app');
const url = new URL(appSecret.DATABASE_URL);
const appPw = decodeURIComponent(url.password);
const rdsSecretArn = execSync(`aws rds describe-db-instances --db-instance-identifier <slug>-uat-db --query "DBInstances[0].MasterUserSecret.SecretArn" --output text`).toString().trim();
const rdsPw = aws(rdsSecretArn).password;
console.log('MATCH:', appPw === rdsPw);
EOF
node "$F2"
```

If that prints `MATCH: false`, the fix is the same rebuild-from-RDS flow as section C's
rotation note, run against the **current** secret (not the template, which would wipe every
other key):

```bash
umask 077; F="$(mktemp /tmp/uat-secret-fix.XXXXXX)"
aws secretsmanager get-secret-value --secret-id uat/<slug>/app --query SecretString --output text > "$F"
./scripts/fix-secret-database-url.sh build --env uat --from-rds-secret --merge-into "$F"
WINPATH="$(cygpath -m "$F")"
aws secretsmanager put-secret-value --secret-id uat/<slug>/app --secret-string "file://$WINPATH" --query VersionStages && rm -f "$F"
```

Then force-redeploy **both** services (section C) — this has broken sign-in, sign-out, and
every MCP tool call simultaneously both times it has happened, since `web` and `mcp` share
the one `DATABASE_URL`. Re-run the compare script after redeploying; `MATCH: true` is the
actual proof, not just a clean deploy.

## E. Run a schema migration or a one-off command inside the VPC

RDS is private; never run `db:deploy` from a workstation.

```bash
CLUSTER=<slug>-uat-cluster
NET="$(aws ecs describe-services --cluster "$CLUSTER" --services <slug>-uat-web --query 'services[0].networkConfiguration' --output json)"
run_task() {  # <task-definition-family> <overrides-json>
  local arn code
  arn="$(aws ecs run-task --cluster "$CLUSTER" --task-definition "$1" --launch-type FARGATE \
    --network-configuration "$NET" --overrides "$2" --query 'tasks[0].taskArn' --output text)"
  aws ecs wait tasks-stopped --cluster "$CLUSTER" --tasks "$arn"
  code="$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$arn" --query 'tasks[0].containers[0].exitCode' --output text)"
  echo "task=$arn exit=$code"; test "$code" = "0"
}
run_task <slug>-uat-web '{"containerOverrides":[{"name":"web","command":["node_modules/.bin/prisma","migrate","deploy"]}]}'
```

`aws ecs run-task` exits 0 even when the container fails; the helper reads the container's
exit code. **EVIDENCE 14.E** — the `task=... exit=0` line and the last lines of
`aws logs tail /ecs/<slug>-uat-web --since 10m`.

**Data loaders:** `Dockerfile.mcp` copies the one-off scripts it supports by name
(`scripts/ingest-documents.ts`, `scripts/drive-preflight.ts`). Run them in the `mcp` family
with a command override, for example a manual ingestion:

```bash
run_task <slug>-uat-mcp '{"containerOverrides":[{"name":"mcp","command":["node_modules/.bin/tsx","scripts/ingest-documents.ts"]}]}'
MSYS_NO_PATHCONV=1 aws logs tail /ecs/<slug>-uat-mcp --since 15m
```

Add `"--force"` to the command only to re-index every file (after a parser change). The
hourly schedule (section L) never uses it. A manual run while a scheduled one is in
progress steps aside with `ALREADY_RUNNING`. Add any new script to `Dockerfile.mcp`
alongside the files it imports.

## F. Offboard a user

`/admin/users/<id>` → Danger zone → **Remove user**, gated on `USERS_MANAGE`. One action
does the whole thing: leaves every group, revokes every direct scope and MCP token,
**deletes the user's existing sessions immediately** (no more waiting out a 30-day cookie),
sets status `DISABLED`, and logs `user_removed`. This superseded the old manual
revoke-scopes/leave-groups/revoke-tokens checklist, and closed the gap that checklist used
to carry a warning about: `getSessionUser` now refuses a `DISABLED` user's session outright,
and the Google callback rejects a `DISABLED` user's login before the domain/invite gate —
so a removed person cannot just sign in again and get a new session either. A user cannot
remove themselves.

It is a soft removal (status `DISABLED`), not a row delete — `AuditEvent` and `AuthSession`
both reference the user, and that audit trail is exactly what should survive someone
leaving.

If the user is the sole active member of the protected `admin` group, the action refuses
and aborts entirely (nothing partially revoked) — the group-removal guard runs first and
fails closed. Add another `admin` member first, or confirm this person genuinely should be
the last one standing before proceeding differently.

**EVIDENCE 14.F** — activity screen shows `user_removed` for the user, and a subsequent
sign-in attempt from that account lands on `/login?status=disabled`.

## K. Recover the protected `admin` group

Two distinct failure states (ADR 0002 section 3):

- **Emptied but the group row exists** (e.g. every member was somehow removed). Layer 3
  self-heals: have the `INITIAL_ADMIN_EMAIL` account sign in. `ensureBootstrapAdmin` adds
  them back and writes `bootstrap_admin_self_heal` to the activity log — no database access
  needed. The two Postgres triggers created in the `add_group_permissions` migration make
  emptying the group through row mutation (including a hand-run SQL task) impossible in the
  first place; this path only matters if that invariant was bypassed some other way (e.g. a
  restore, below).
- **The group row itself is missing** (restore from a pre-migration snapshot, or a database
  seeded before the migration ran). The self-heal in the previous bullet cannot act — it
  needs the row to exist. Recreate it by slug via a one-off task (section E), matching the
  `add_group_permissions` migration's seed exactly:

  ```sql
  INSERT INTO "Group" ("id","slug","name","isSystem","updatedAt")
  VALUES ('grp_admin','admin','Admin',TRUE,now())
  ON CONFLICT ("slug") DO NOTHING;
  INSERT INTO "GroupPermissionGrant" ("id","groupId","permission","grantedBy")
  VALUES
    ('gpg_admin_users_manage','grp_admin','USERS_MANAGE','system:recovery'),
    ('gpg_admin_groups_manage','grp_admin','GROUPS_MANAGE','system:recovery'),
    ('gpg_admin_agents_manage','grp_admin','AGENTS_MANAGE','system:recovery'),
    ('gpg_admin_clients_manage','grp_admin','CLIENTS_MANAGE','system:recovery'),
    ('gpg_admin_activity_read','grp_admin','ACTIVITY_READ','system:recovery')
  ON CONFLICT ("groupId","permission") DO NOTHING;
  ```

  Then have `INITIAL_ADMIN_EMAIL` sign in to self-heal into it, as above.

**EVIDENCE 14.K** — `GroupMembership` query showing an active row for the recovered admin,
and the `bootstrap_admin_self_heal` activity event.

## G. Infrastructure change

```bash
terraform -chdir=infra/environments/uat init -backend-config=../../my.backend.hcl
terraform -chdir=infra/environments/uat plan -out tf.plan | grep -E '^Plan:|must be replaced|will be destroyed'
```

Apply only when the plan contains no replacement or destroy you did not decide on. A
change to `web_secret_keys`/`mcp_secret_keys` re-registers task definitions but does not
move the services: follow with `aws ecs update-service --task-definition <family>` for each.

**Stop if the plan changes `aws_ecs_task_definition.mcp` and you did not mean to.** The
hourly ingestion schedule (section L) runs the latest revision of the `mcp` family, so a
Terraform-registered revision carrying an old `image_uris` pin would become what scheduled
runs use, until the next deploy registers a newer one.

The ingestion alert email is a variable that is never committed. Export it before planning
when alerts should stay on: `export TF_VAR_ingest_alert_email=<address>`. If you leave it
unset, the plan removes the alert resources.

**EVIDENCE 14.G** — the plan line and, if keys changed, the `describe-task-definition`
secrets list afterwards.

## H. Park or unpark an environment (cost)

Set `activate_services = false` and apply: Fargate tasks and their public IPs stop billing.
ALB, RDS, secrets and logs keep billing. Reverse with `true` and the pinned `image_uris`.
Rough active cost: ALB ≈ $16/mo, two 0.5 vCPU / 1 GB tasks ≈ $18/mo, `db.t3.micro` ≈ $15/mo,
public IPv4 addresses ≈ $15/mo, plus logs and storage.

**EVIDENCE 14.H** — `describe-services` showing `desired 0, running 0` (parked) or `1, 1`.

## I. Diagnose a failed release

1. The Actions run: the migration step prints `stopCode`/`stoppedReason`.
2. `aws logs tail /ecs/<slug>-uat-web --since 30m --follow` and the `-mcp` group.
3. `aws ecs describe-services ... --query 'services[0].events[:10]'` for circuit-breaker
   rollbacks and `CannotPullContainerError`.
4. `/api/health` is liveness only; it does not touch the database.

**The ALB is public, and internet scanners probe it constantly** — `web`'s log is never
clean. `[404] GET /.env`, `[404] GET /owa/auth/x.js`, and a stray `[405] POST /` with "No
form actions exist for this page" (1 second after a `/.env` probe) are routine bot noise,
not a real error, even though the 405 looks alarming out of context. Every form in this app that submits `POST` points at a real action path
(`/api/auth/logout`, `/admin?/...`, etc.); a 405 at the bare `/` is never one of them.
Correlate by exact timestamp against what a human actually did before concluding a log
line is the bug.

## J. Recover lost state

- **Bootstrap state lost:** `terraform -chdir=infra/bootstrap import aws_s3_bucket.state <bucket>` and the versioning, encryption, public-access-block and bucket-policy resources likewise.
- **Environment state lost:** the S3 bucket is versioned; restore the previous object version of `environments/<env>/terraform.tfstate`.
- **Repository transferred to another owner:** the OIDC subject changes. Re-run Play 06 step 3 and re-apply `global`, or every deploy fails at assume-role.

## L. Scheduled ingestion (hourly, incremental)

EventBridge Scheduler starts `scripts/ingest-documents.ts` in the `mcp` family every hour
(`infra/modules/environment/ingest-schedule.tf`, enabled per environment root with
`ingest_schedule_enabled`). Each run lists Drive and fetches only new or changed files. A
quiet hour writes nothing but its sync record. The schedule never passes `--force`, and
runs never overlap: a run that finds another in progress logs `sync.skipped_already_running`
and exits 0.

**Enable or change it:** section G, with `TF_VAR_ingest_alert_email` exported. The first
apply creates the schedule, its IAM role, a dead-letter queue and, with an email set, an SNS
topic plus three alarms. AWS emails a subscription confirmation, and no alert is delivered
until someone clicks it.

**Check it is running:**

```bash
aws scheduler get-schedule --name <slug>-uat-ingest --query '{state:State,expr:ScheduleExpression}'
MSYS_NO_PATHCONV=1 aws logs filter-log-events --log-group-name /ecs/<slug>-uat-mcp \
  --start-time $(( ($(date +%s) - 3*3600) * 1000 )) --filter-pattern '{ $.event = "ingest.run" }' \
  --query 'events[].message' --output text | tr '\t' '\n' | tail -5
```

Each run logs one `ingest.run` line with its outcome and counts, never file titles. The
`document_source_changes` MCP tool should report `upToDate: true` within an hour of a Drive
change.

**Alerts** (email, sent on entering ALARM and again on recovery):
- `<slug>-uat-ingest-failed`: a run failed, partially failed (some files could not be
  parsed), or crashed. Read its `ingest.run` line and the MCP tool `document_source_status`.
  `AUTH_FAILED` or `NOT_SHARED` usually means the service-account key or the folder share
  changed (ADR 0001 section 7).
- `<slug>-uat-ingest-missed`: no run has logged for three hours. The schedule may be
  disabled, or tasks may be failing to start: check `aws ecs list-tasks --cluster
  <slug>-uat-cluster --started-by scheduled-ingest --desired-status STOPPED`, then
  `describe-tasks` for the `stoppedReason`.
- `<slug>-uat-ingest-dlq`: the scheduler could not call RunTask after its retries. The
  reason is in the queue: `aws sqs receive-message --queue-url "$(terraform -chdir=infra/environments/uat output -raw ingest_dlq_url)" --attribute-names All --message-attribute-names All`.

**Pause or resume:** set `ingest_schedule_enabled = false` (or back to `true`) in the
environment root and apply via section G. Pausing removes the schedule, its role, the queue
and the alarms. Manual runs (section E) keep working either way.

**EVIDENCE 14.L**: the `get-schedule` output showing `ENABLED`, and at least one
`ingest.run` line logged after the apply (from the filter command above).

## M. Rotate or replace the Drive service account

Needed when the key is compromised, the Google Cloud project it lived in has to be
replaced, or `drive.preflight` starts returning `AUTH_FAILED`/`accessNotConfigured` with
no secret-side explanation.

**Two mistakes are easy to make in Google Cloud Console and both look fine until the
preflight task actually runs:**

1. **Service Accounts vs. OAuth client IDs are two different credential types**, created
   from two different pages, and Google's "Create credentials" flow on the Credentials
   page offers both. Only **IAM & Admin → Service Accounts → (account) → Keys → Add Key →
   JSON** produces a real service-account key (`type: "service_account"`, `client_email`,
   `private_key` at the top level, ~2-3 KB). An OAuth client's downloaded JSON instead has
   a single top-level `"installed"` key and is much smaller (~400 bytes) — using one of
   those here fails ingestion with `Decoded service-account key is missing client_email or
   private_key`. Check before merging it into the secret:
   ```bash
   jq 'keys' ~/Downloads/the-key.json   # expect client_email, private_key, type, ... — not just "installed"
   ```
2. **A brand-new Google Cloud project does not have the Drive API enabled by default.**
   Skipping this produces `drive.preflight.auth_failed` with `googleErrorCode:
   "accessNotConfigured"` — fix in that same project: **APIs & Services → Library → "Google
   Drive API" → Enable**. No redeploy needed; it takes effect within about a minute.

**The flow, once the key file is confirmed correct:**

```bash
# 1. Share the Drive folder with the new service account's email (Viewer) — in the Drive UI.
# 2. Merge the new key into the secret, base64-encoded, without ever printing it:
umask 077; F="$(mktemp /tmp/uat-secret-update.XXXXXX)"
aws secretsmanager get-secret-value --secret-id uat/<slug>/app --query SecretString --output text > "$F"
jq --arg key "$(base64 -w0 ~/Downloads/the-key.json)" '.GOOGLE_DRIVE_SA_KEY_B64 = $key' "$F" > "$F.tmp" && mv "$F.tmp" "$F"
WINPATH="$(cygpath -m "$F")"
aws secretsmanager put-secret-value --secret-id uat/<slug>/app --secret-string "file://$WINPATH" --query VersionStages && rm -f "$F"

# 3. Redeploy mcp only — web never reads this key.
aws ecs update-service --cluster <slug>-uat-cluster --service <slug>-uat-mcp --force-new-deployment --query 'service.serviceName' --output text
aws ecs wait services-stable --cluster <slug>-uat-cluster --services <slug>-uat-mcp && echo STABLE

# 4. Verify reachability before trusting it with a real sync (section E's run_task helper):
run_task <slug>-uat-mcp '{"containerOverrides":[{"name":"mcp","command":["node_modules/.bin/tsx","scripts/drive-preflight.ts"]}]}'
```

`drive-preflight` only proves the folder is reachable — it does not prove the account can
actually fetch and parse a real file. Follow it with one real ingestion run (section E) and
confirm the `ingest.run` line reports `outcome: OK` with non-zero `ingested`/`added`/
`updated` counts, not just that the task exited 0.

**EVIDENCE 14.M** — the key-shape `jq 'keys'` check, `STABLE`, the preflight task's `OK`
line, and a real ingestion run's `ingest.run` summary.
