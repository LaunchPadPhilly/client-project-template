# Play 14 — Operations

**Goal:** the routine and exceptional procedures a developer will need after go-live,
each with its own evidence. Run the section you need; none depend on each other.

**Needs:** Play 10 closed for UAT, Play 12 for production. Shell exports active.
Replace `uat` / `<slug>-uat` with `production` / `<slug>` for production.

## A. Release a change

1. Open a PR; `ci.yml` must pass; merge to `main`.
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
every MCP tool call simultaneously every time it has happened, since `web` and `mcp` share
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

**Data loaders:** earlier guidance said to run `tsx scripts/<loader>.ts` in
the `mcp` image. The `mcp` image does **not** copy `scripts/` today; add a
`COPY scripts ./scripts` line to `Dockerfile.mcp` (and any directories the loader imports)
before relying on that path.

## F. Offboard a user

In `/admin/users/<id>`: revoke every scope (kills MCP data access immediately), revoke the
admin role, "Revoke all" tokens. The user's **browser session** survives until expiry
because `DISABLED` is not enforced (Play 13 gap). To end it now, run a one-off task with a
parameterized SQL statement via Prisma, or wait for the 30-day expiry. Record the choice.

**EVIDENCE 14.F** — activity screen shows `revoke_scope`, `revoke_admin_role`,
`mcp_all_tokens_revoked` for the user.

## G. Infrastructure change

```bash
terraform -chdir=infra/environments/uat init -backend-config=../../my.backend.hcl
terraform -chdir=infra/environments/uat plan -out tf.plan | grep -E '^Plan:|must be replaced|will be destroyed'
```

Apply only when the plan contains no replacement or destroy you did not decide on. A
change to `web_secret_keys`/`mcp_secret_keys` re-registers task definitions but does not
move the services: follow with `aws ecs update-service --task-definition <family>` for each.

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
