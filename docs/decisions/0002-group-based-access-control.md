# 0002 — Group-based access control replacing the ADMIN/STAFF/VIEWER role enum

- Status: Accepted (design); implementation not started
- Date: 2026-09-23
- Scope: authorization model for the SvelteKit web app and the MCP server, both environments
- Supersedes: the `Role` / `UserRole` / `RoleName` model from `prisma/migrations/0001_init`
- Related: ADR 0001 (established the two-migration discipline and the `McpScope` recipe)

## Context

### What was verified on disk before this decision

Every claim below was read, not assumed.

- `prisma/schema.prisma` declares `Role { name: RoleName @unique }`, `UserRole`
  (`@@id([userId, roleId])`, hard-deleted on revoke), and `enum RoleName { ADMIN STAFF VIEWER }`.
- **`STAFF` and `VIEWER` are vestigial.** The only occurrences in the whole tree are
  `prisma/schema.prisma:313-314` and `prisma/migrations/0001_init/migration.sql:8`. No code
  branches on them. Replacing the enum therefore costs nothing in behaviour.
- The *entire* authorization surface for site management is the string comparison
  `roles.some((userRole) => userRole.role.name === 'ADMIN')`, repeated verbatim in six
  places: `src/lib/server/auth/guards.ts:6`, `src/routes/admin/+layout.server.ts:10`,
  `src/routes/admin/users/[id]/+page.server.ts:113`, `src/routes/admin/+page.server.ts:150`,
  `src/routes/+layout.server.ts:17`, `src/routes/+page.server.ts:10`. It is binary: there is
  no finer gate than admin-or-not.
- `src/lib/server/mcp/scopes.ts:43` `getActiveScopes(userId)` is the single source of MCP
  data authority. It is called per request by `authenticateOAuthToken`
  (`src/lib/server/mcp/handler.ts:216`) and by both halves of `/mcp/consent`
  (`src/routes/mcp/consent/+page.server.ts:47,66`). Nothing caches it.
- `src/hooks.server.ts` calls `getSessionUser` on **every** request, and
  `src/lib/server/auth/session.ts:35-36` eagerly includes `roles` and non-revoked
  `mcpScopes`. Web-side authority is therefore already recomputed per request; there is no
  claim baked into the session cookie.
- `McpUserScopeGrant` is per-user only, with a soft-revoke shape (`revokedAt`/`revokedBy`)
  and `@@unique([userId, scope])`. `/admin`'s `grantScope` action upserts and clears
  `revokedAt`; `revokeScope` stamps it. There is no group concept anywhere.
- `bootstrapInitialAdmin` (`src/routes/api/auth/google/callback/+server.ts:123-149`) runs
  **only** when `existingUser === null` — literally the first-ever login — and only when
  `identity.email === config.initialAdminEmail`, an exact case-sensitive compare
  (`src/lib/server/auth/google.ts:32`, no normalisation). It creates the `ADMIN` role, the
  `UserRole` row, and every `McpScope` as a direct grant. It is the only path that produces
  an admin where none exists.
- `AuditEvent` rows are written with `resource: 'User'` + `resourceId: <userId>` by the
  `logAudit` helper (`src/routes/admin/+page.server.ts:395`). `/admin/users/[id]` reads
  exactly that shape (`where: { resourceId: user.id, resource: 'User' }`). The activity
  screen's `securityActions` allowlist is `src/routes/admin/+page.server.ts:11-16`.
- `src/lib/server/mcp/oauthConfig.ts:8` derives advertised OAuth scopes from `allScopes`
  unless `MCP_OAUTH_SCOPES` overrides them.
- `INITIAL_ADMIN_EMAIL` already exists as a key in `.env.example:58` and in
  `web_secret_keys` (`infra/environments/uat/variables.tf:42`).
- `AgentToken.scope` is self-contained — no user, nothing to intersect. Groups cannot
  apply to it.

### The requirement

Admin-defined groups carrying a custom permission bundle must control **both** MCP tool
access and site-management capability. The hardcoded three-value role enum is replaced,
not supplemented.

## Decision

### 1. Two vocabularies, deliberately not merged

`McpScope` stays exactly as it is — `DATA_READ`, `REPORTS_READ`, `DOCUMENTS_READ`, wire
names in `scopes.ts`. **No new `McpScope` value is added by this work.**

A second, separate enum carries site-management capability:

```prisma
/// What a group may do to the site itself. Deliberately NOT McpScope: these must never
/// be wire-mapped, never advertised in OAuth discovery, and never requestable by an MCP
/// client. Keeping them a distinct enum makes that a type error rather than a review note.
enum SitePermission {
  USERS_MANAGE      // invite users, view /admin?screen=users and /admin/users/[id],
                    // revoke a user's MCP access/refresh tokens
  GROUPS_MANAGE     // create/rename/delete groups, edit their grants, add/remove members
  AGENTS_MANAGE     // create and revoke AgentTokens
  CLIENTS_MANAGE    // enable/disable McpOAuthClients (and cut their live tokens)
  ACTIVITY_READ     // read /admin?screen=activity
}
```

Five values, one per thing `/admin` can actually do today. The set is derived from the
existing form actions, not invented: `inviteUser` + `revokeToken` + `revokeAllTokens` ->
`USERS_MANAGE`; `create` + `revoke` -> `AGENTS_MANAGE`; `disable` + `enable` ->
`CLIENTS_MANAGE`; the activity load -> `ACTIVITY_READ`; the new group actions ->
`GROUPS_MANAGE`.

Rejected: a single merged permission enum. Merging would put `USERS_MANAGE` into
`allScopes`, therefore into `oauthConfig.ts`'s advertised scope list, therefore into
`/mcp/consent` as something an AI client could ask a user to approve. That is a hole in the
OAuth surface, and no amount of filtering elsewhere is as safe as the two types never
meeting.

Rejected: an `ADMIN_ACCESS` permission gating `/admin` itself. It creates a trap where a
group has `USERS_MANAGE` but nothing works because `ADMIN_ACCESS` was forgotten. Instead
the `/admin` layout admits anyone holding **at least one** `SitePermission`, and each
screen and each action checks its own.

### 2. Data model

Four new models. All soft-revoke, mirroring `McpUserScopeGrant` rather than `UserRole`'s
hard delete, so `/admin/users/[id]`'s history panel keeps working the way it does today.

```prisma
/// An admin-defined bundle of MCP scopes and site permissions. `slug` is the stable
/// machine key (migrations and the bootstrap self-heal address groups by slug, never by
/// name, which admins may rename). `isSystem` marks the protected group — see section 3.
model Group {
  id               String                 @id @default(cuid())
  slug             String                 @unique
  name             String
  description      String?
  isSystem         Boolean                @default(false)
  createdAt        DateTime               @default(now())
  updatedAt        DateTime               @updatedAt
  createdBy        String?
  memberships      GroupMembership[]
  scopeGrants      GroupScopeGrant[]
  permissionGrants GroupPermissionGrant[]
}

model GroupMembership {
  id        String    @id @default(cuid())
  userId    String
  groupId   String
  addedAt   DateTime  @default(now())
  addedBy   String?
  removedAt DateTime?
  removedBy String?
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  group     Group     @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@unique([userId, groupId])
  @@index([userId, removedAt])
  @@index([groupId, removedAt])
}

model GroupScopeGrant {
  id        String    @id @default(cuid())
  groupId   String
  scope     McpScope
  grantedAt DateTime  @default(now())
  grantedBy String?
  revokedAt DateTime?
  revokedBy String?
  group     Group     @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@unique([groupId, scope])
  @@index([groupId, revokedAt])
}

model GroupPermissionGrant {
  id         String         @id @default(cuid())
  groupId    String
  permission SitePermission
  grantedAt  DateTime       @default(now())
  grantedBy  String?
  revokedAt  DateTime?
  revokedBy  String?
  group      Group          @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@unique([groupId, permission])
  @@index([groupId, revokedAt])
}
```

`User` gains `groupMemberships GroupMembership[]`.

`@@unique([userId, groupId])` with soft removal means re-adding a former member is an
upsert that clears `removedAt` — the identical shape the existing `grantScope` action
already uses, so the developer copies a pattern rather than inventing one.

**`McpUserScopeGrant` is kept.** Effective MCP scope becomes the *union* of direct grants
and group-derived grants. Reasons: the migration stays purely additive (the current UAT
admin's bootstrap scopes keep working whatever happens to the group backfill); the
first-login `grantDefaultScope` path — the riskiest code in the app — is not touched; and
a one-person exception does not require inventing a one-person group. The cost is stated
in section 7 risk 3 and mitigated by showing provenance in the UI. Retiring direct grants
is a named follow-up, not v1.

**Site permissions have exactly one source: groups.** There is no per-user site-permission
grant. This is what makes the lockout invariant in section 3 checkable with a single query.

### 3. The lockout problem and its safeguard

With `ADMIN` gone, the failure mode is: the last group holding `GROUPS_MANAGE` is deleted,
emptied, or stripped of that grant, and no human can ever administer the system again. The
only recovery would be direct database surgery through a one-off ECS task against a private
RDS instance. That is unacceptable as a designed-in outcome. Three layers:

#### Layer 1 — application guards (the primary gate)

A protected group is seeded by the migration: `slug = 'admin'`, `isSystem = true`,
holding all five `SitePermission` values. Every group action in
`src/routes/admin/+page.server.ts` refuses, with a `fail(400, ...)` message, to:

- **a.** delete a group where `isSystem = true`;
- **b.** revoke `GROUPS_MANAGE` or `USERS_MANAGE` from a group where `isSystem = true`;
- **c.** remove a member when that would leave the protected group with zero active members;
- **d.** remove *yourself* from the protected group — mirroring the existing
  self-protection at `src/routes/admin/+page.server.ts:361`
  (`'You cannot revoke your own admin access.'`), which already establishes this pattern.

Check **c** must be race-safe. Postgres defaults to READ COMMITTED, so two concurrent
removals could each count two members and both succeed. The action runs inside
`prisma.$transaction` and first takes a row lock on the group:

```ts
await prisma.$transaction(async (tx) => {
  await tx.$queryRaw`SELECT id FROM "Group" WHERE id = ${groupId} FOR UPDATE`;
  // ...count active memberships, then mutate, inside the same transaction
});
```

Tagged-template parameterisation only, per `SECURITY.md`.

Every refusal writes `AuditEvent { action: 'protected_group_guard_blocked' }`, which is
added to the `securityActions` allowlist so it surfaces on the activity screen's security
list.

#### Layer 2 — database triggers (belt and braces)

Layer 1 protects the UI. It does not protect against the thing this repository actually
does for data fixes: a one-off ECS task running ad-hoc SQL (Play 14). A hand-typed
`DELETE FROM "GroupMembership" WHERE ...` bypasses every TypeScript guard. Two triggers,
created as raw SQL inside migration M1:

- `BEFORE DELETE ON "Group"` — `RAISE EXCEPTION` when `OLD."isSystem"`.
- `AFTER INSERT OR UPDATE OR DELETE ON "GroupMembership"` (statement-level, deferred to end
  of statement) — `RAISE EXCEPTION` when the protected group's count of memberships with
  `removedAt IS NULL` is zero.

Caveats to record, not hide: triggers are invisible to `prisma/schema.prisma`, so they
exist only because a migration file creates them — `prisma migrate reset` recreates them
from the same file, but a future `migrate dev` that rewrites history could drop them.
Second, because `GroupMembership.userId` cascades from `User`, the membership trigger will
also block deleting the last administrator *user*. There is no delete-user feature today
(verified — no such action exists), and when one is added it will have to remove
memberships first. That ordering requirement is correct behaviour, not a defect.

#### Layer 3 — standing break-glass via `INITIAL_ADMIN_EMAIL`

`bootstrapInitialAdmin` becomes `ensureBootstrapAdmin`, called on **every** login by
`INITIAL_ADMIN_EMAIL` rather than only on the first-ever login. Its body is guarded:

- If the protected group has at least one active member, it does nothing at all.
- If it has zero, it adds the signing-in user to the protected group and writes
  `AuditEvent { action: 'bootstrap_admin_self_heal' }` — also added to `securityActions`.

This is not a backdoor that widens anyone's authority: `INITIAL_ADMIN_EMAIL` is a key in
the environment's Secrets Manager JSON, so whoever can set it already controls the
deployment and could reach the database directly. What it buys is turning "recovery
requires a DBA-grade one-off task against private RDS" into "the operator signs in".

Layers 2 and 3 are not redundant with each other. The trigger makes zero-members
unreachable *through row mutation*; it cannot cover a restore from snapshot, a
`migrate reset`, a database seeded before the backfill, or a future migration that drops
the trigger. Those are exactly the states Layer 3 covers.

While editing that function, also lowercase both sides of the `INITIAL_ADMIN_EMAIL`
comparison. `playbook/13-security-acceptance.md:98` already records the case-sensitive
compare as a known gap; a break-glass that silently fails on a capitalised secret value is
worse than the gap it replaces.

### 4. Effective-permission computation

#### MCP scope — the live-intersection guarantee is preserved

`getActiveScopes(userId)` in `src/lib/server/mcp/scopes.ts` is the only function that
changes. It returns the **union** of:

- `McpUserScopeGrant` rows for the user with `revokedAt IS NULL` (today's query, unchanged); and
- `GroupScopeGrant` rows with `revokedAt IS NULL` whose group has a `GroupMembership` for
  the user with `removedAt IS NULL`.

Two queries in one `Promise.all`, both index-covered by
`GroupMembership(userId, removedAt)` and `GroupScopeGrant(groupId, revokedAt)`.

Because `handler.ts:216-217` calls this function on **every** MCP request and intersects
the result with the token's issued scope, **live revocation is preserved exactly as it
works today**: removing a user from a group, or revoking a group's scope grant, denies the
next MCP request from an already-issued token. No re-login, no token reissue, no client
reconnect. Same for `/mcp/consent`, which calls the same function.

**This result must not be cached or memoised.** That is the single property the whole
authorization story rests on, it is written into `SECURITY.md` as a stated guarantee, and a
well-meaning per-process cache would silently break it. Call it out in review.

`handler.ts` itself is **not modified**. Neither is `guardedToolResult`, `hasScope`, the
`Principal` type, or any tool. The change lands entirely behind the existing seam.

`AgentToken` is explicitly unaffected — no user, nothing to intersect, scopes remain its own.

#### Site permissions — live because the session already reloads per request

`getSessionUser` (`src/lib/server/auth/session.ts`) adds to its `include`:

```ts
groupMemberships: {
  where: { removedAt: null },
  include: {
    group: {
      include: {
        permissionGrants: { where: { revokedAt: null } },
        scopeGrants:      { where: { revokedAt: null } }
      }
    }
  }
}
```

and drops `roles`. Since `src/hooks.server.ts` runs `getSessionUser` on every request, a
permission removed from a group applies on that user's **next page load** — no session
invalidation, no forced re-login. Same property the role check has today, kept for the same
reason.

Pulling the group scope grants into the session include as well is what lets
`hasGrantedScope` stay a synchronous, zero-query function.

#### `src/lib/server/auth/guards.ts` — rewritten

- **Delete `isAdmin`.** Do not leave a shim. A surviving `isAdmin()` would let call sites
  keep the coarse check and defeat the entire change; forcing each site to name a permission
  is the point.
- `hasPermission(user, permission: SitePermission): boolean` — any active membership whose
  group has an active grant for that permission.
- `hasAnyPermission(user): boolean` — for the `/admin` layout gate.
- `requirePermissionPage(user, permission, returnTo)` — redirect anonymous users to Google
  login (as `requireAdminPage` does), 403 otherwise.
- `requirePermissionApi(user, permission)` — 401/403, replacing `requireAdminApi`.
- `hasGrantedScope(user, scope)` — **must be widened to include group-derived scopes.** If
  it is not, a user granted `REPORTS_READ` through a group gets MCP access but a 403 on the
  scope-gated web page. This is the easiest thing in the whole change to miss.
- `requireScopePage` — signature unchanged; benefits from the widened `hasGrantedScope`.
- The doc comment at `guards.ts:30-38` (admin does not imply data access) stays true and
  stays verbatim — see section 5.

### 5. Seeded starter groups

Created by migration M1, all editable afterwards except as noted. **Reseeded** to match the
client's actual team structure rather than the illustrative set originally drafted here —
`operators` and `read-only-partners` were dropped, and the client settled on exactly two
groups: the protected group, renamed `administrators` -> `admin`, and a single
`program_staff` group carrying the combined data-scope grant that an earlier draft split
across `data_team`/`finance_team`. `Group.isSystem` (not the slug or name) is what the
lockout guards key off, so none of this touches guard logic — only the
`PROTECTED_GROUP_SLUG` constant and the migration's literal seed rows.

| slug | name | `SitePermission` | `McpScope` | notes |
|---|---|---|---|---|
| `admin` | Admin | all five | **none** | `isSystem = true`; undeletable |
| `program_staff` | Program Staff | none | `REPORTS_READ`, `DOCUMENTS_READ` | ordinary group; the only non-admin group |

Two things in that table are load-bearing.

**Admin gets no MCP scopes.** `SECURITY.md` states "Admin does **not** imply data
access; an admin grants scopes to themself through the UI, leaving an audit event", and
`guards.ts:30-38` explains why. Granting the admin group every scope would erase that audit
trail by making data access implicit in administration. The existing admin keeps their data
access through their existing direct `McpUserScopeGrant` rows from bootstrap — untouched by
this migration.

**`AGENTS_MANAGE` is only in Admin.** An agent token can be minted with any `McpScope`, so
`AGENTS_MANAGE` is a path to any data scope (see section 7 risk 4). For v1 it stays in the
`admin` group only — no other seeded group holds any `SitePermission`.

### 6. Migrations — two, in two separate deploys

Note on the enum rule from ADR 0001 section 6: it applies to `ALTER TYPE ... ADD VALUE`,
where the new value cannot be used in the transaction that added it. A brand-new
`CREATE TYPE` can be created and used in the same migration, and this work adds no value to
an existing enum. The split below exists for a different and stronger reason — **never drop
the old authorization source in the same deploy that introduces the new one.**

#### M1 `add_group_permissions` — purely additive, ships with the code change

1. `CREATE TYPE "SitePermission" AS ENUM ('USERS_MANAGE','GROUPS_MANAGE','AGENTS_MANAGE','CLIENTS_MANAGE','ACTIVITY_READ');`
2. Create `Group`, `GroupMembership`, `GroupScopeGrant`, `GroupPermissionGrant` with their
   indexes, uniques and foreign keys.
3. Insert the two groups from section 5 with **literal, readable primary keys** (e.g.
   `'grp_admin'`) so the SQL is self-contained and idempotent. Prisma's
   `@default(cuid())` only supplies a default; any string id is valid.
4. Insert their scope and permission grants, `grantedBy = 'system:migration'`.
5. **Backfill** — the clause that protects the live UAT admin:

   ```sql
   INSERT INTO "GroupMembership" ("id","userId","groupId","addedBy")
   SELECT 'gm_' || ur."userId", ur."userId", 'grp_admin', 'system:migration'
   FROM "UserRole" ur
   JOIN "Role" r ON r.id = ur."roleId"
   WHERE r.name = 'ADMIN'
   ON CONFLICT ("userId","groupId") DO NOTHING;
   ```

6. Create the two triggers from section 3 Layer 2 — **after** the backfill, so the
   membership trigger cannot fire against the intermediate empty state.
7. **Does not touch** `Role`, `UserRole` or `RoleName`. Those tables keep their rows and
   stay declared in `prisma/schema.prisma` through this release, so `prisma validate` passes
   and a roll-forward fix can still read them.

#### M2 `drop_legacy_roles` — destructive, ships in a **later, separate PR and deploy**

1. A guard that aborts the migration rather than completing it against a bad database:

   ```sql
   DO $$ BEGIN
     IF (SELECT count(*) FROM "GroupMembership"
         WHERE "groupId" = 'grp_admin' AND "removedAt" IS NULL) = 0 THEN
       RAISE EXCEPTION 'Refusing to drop legacy roles: admin group has no active members';
     END IF;
   END $$;
   ```
2. `DROP TABLE "UserRole"; DROP TABLE "Role"; DROP TYPE "RoleName";` and remove all three
   from `prisma/schema.prisma`.

**Hard sequencing requirement:** `prisma migrate deploy` applies every committed migration
in one run. M2 must therefore be authored in a *later* PR, after M1 is live in UAT and the
section 9 evidence has been pasted. Committing both together collapses the safety margin to
zero. Make this a PR checklist item.

Both migrations require the existing blocking `prisma migrate deploy` one-off `run-task` in
`deploy.yml`. No pipeline change.

### 7. Risks

1. **Migration risk to the live UAT database.** The backfill in M1 step 5 is the only thing
   between the current admin and a permanent 403. Mitigated by: M1 being additive and
   reversible by dropping four tables; M2 deferred to a later deploy so `UserRole` remains a
   recovery source; M2's own abort guard; and the mandatory pre/post email diff in section 9.
2. **Lockout.** Addressed by the three layers in section 3. Residual: a restore from a
   pre-migration snapshot leaves no protected group at all — recovery is Layer 3, which
   requires the group *row* to exist, so Play 14 must document recreating it by slug.
3. **Two sources of MCP scope.** Removing a user from a group does **not** revoke a scope
   they also hold directly. An admin revoking someone's access must clear both. Mitigated by
   UI provenance (section 8): every scope is labelled `direct` or `via <group>`, on both the
   users table and `/admin/users/[id]`. Retiring direct grants is the named follow-up.
4. **Privilege escalation.** `GROUPS_MANAGE` is total — a holder can grant themselves every
   scope and permission. `AGENTS_MANAGE` is a data-scope escalation — a holder can mint an
   agent token carrying any `McpScope`. Both are inherent to delegating administration.
   Contained in v1 by keeping both in the `admin` group only, documented in the group screen's
   help text, and audited. Restricting mintable agent scopes to the minter's own effective
   scopes is a named follow-up.
5. **OAuth surface.** Unchanged. No `McpScope` value is added, so `MCP_OAUTH_SCOPES` in both
   environment secrets stays as-is and `oauthConfig.ts` is not edited. Review check:
   `SitePermission` must not be imported by `scopes.ts` or `oauthConfig.ts`, must not appear
   in `allScopes`, and must have no wire mapping.
6. **Hot-path cost.** One extra indexed query per MCP request in `getActiveScopes`. Small
   tables, covered indexes. The mitigation that must *not* be applied is caching (section 4).
7. **Audit completeness.** Group mutations must be audited to the same standard as the role
   grants they replace, or this is a regression. See section 8.
8. **Stale MCP tool lists** (`CLAUDE.md`) do not apply — no tool definition changes. A
   group-driven scope loss surfaces as `guardedToolResult`'s permission message on the
   client's existing tool list, which is the designed behaviour.
9. **Play 13 known-gap drift.** Row 90 ("`User.status = DISABLED` is not enforced") lists
   the remediation as "revoke all scopes and admin role". After this change the remediation
   is "remove from all groups, revoke direct scopes, delete `AuthSession` rows". The play
   must be updated or it becomes wrong guidance during an incident.

### 8. Audit events

Following the existing convention exactly (`snake_case`, `resource` + `resourceId`, the
`logAudit` helper's shape):

| action | resource | resourceId | metadata |
|---|---|---|---|
| `group_created` | `Group` | group id | `{ slug, name }` |
| `group_updated` | `Group` | group id | `{ slug, name }` |
| `group_deleted` | `Group` | group id | `{ slug }` |
| `group_scope_granted` / `group_scope_revoked` | `Group` | group id | `{ scope }` |
| `group_permission_granted` / `group_permission_revoked` | `Group` | group id | `{ permission }` |
| `group_member_added` / `group_member_removed` | `User` | **user id** | `{ groupId, groupSlug }` |
| `protected_group_guard_blocked` | `Group` | group id | `{ attempted, reason }` |
| `bootstrap_admin_self_heal` | `User` | user id | `{ groupSlug }` |

Membership changes are logged against **`User`**, one row, deliberately: that is the exact
shape `/admin/users/[id]`'s panel queries (`resource: 'User'`, `resourceId: user.id`), so
the existing history panel picks them up with no change. A per-group audit panel would need
JSON-path querying and is out of scope for v1; the activity screen already shows everything.

`protected_group_guard_blocked` and `bootstrap_admin_self_heal` are added to the
`securityActions` array at `src/routes/admin/+page.server.ts:11-16`.

`grant_admin_role` / `revoke_admin_role` are no longer produced. Historical rows stay and
still render — they are plain strings.

### 9. Evidence

There is no test suite in this repository (`CLAUDE.md`; `pnpm run test` is an
environment/DB diagnostic). Evidence is therefore gates plus pasted output.

**Gates:** `pnpm run db:format`, `db:validate`, `db:generate`, `pnpm run check`,
`pnpm run build`, `BUILD_TARGET=docker pnpm run build`.

**Migration rehearsal, local, before any deploy.** Seed a local database to look like UAT —
a `Role{name:'ADMIN'}` row plus a `UserRole` row for a test user — run `pnpm run db:deploy`,
then paste the result of a query showing that user has an active `GroupMembership` in
`grp_admin`.

**UAT backfill proof — mandatory, both halves pasted.** Before the deploy, via one-off ECS
task, list the emails that must survive:

```sql
SELECT u.email FROM "User" u
JOIN "UserRole" ur ON ur."userId" = u.id
JOIN "Role" r ON r.id = ur."roleId"
WHERE r.name = 'ADMIN' ORDER BY u.email;
```

After the deploy, run the mirror query over `GroupMembership` where
`groupId = 'grp_admin' AND removedAt IS NULL` and diff the two lists. They must be
identical. This, not a green smoke test, is what proves the live admin did not lose access.

**Permission matrix in the browser on UAT**, mirroring `playbook/13-security-acceptance.md`
section 4:

- A member of `admin` reaches all five screens.
- A member of `program_staff` — which holds no `SitePermission` — gets 403 on `/admin`
  entirely, same as a user in no group.
- A user in no group gets 403 on `/admin` entirely.

**Live-revocation proof — the single most important test.** Connect an MCP client as a user
whose *only* source of `DOCUMENTS_READ` is a group. Call `documents_search` -> success. In
another tab, remove them from the group. Call `documents_search` again **without
reconnecting the client** -> `guardedToolResult`'s permission-denied message. Paste both
tool outputs. This proves the group path preserved the property `SECURITY.md` promises.

**Lockout guard proof.** As the sole member of `admin`, attempt to (a) delete the
group, (b) remove yourself, (c) revoke its `GROUPS_MANAGE` grant. All three refused with a
message; `protected_group_guard_blocked` appears in the activity log.

**Trigger proof.** From a one-off task run
`DELETE FROM "GroupMembership" WHERE "groupId" = 'grp_admin';` and paste the raised
exception.

**Break-glass proof — local only.** Drop the membership trigger locally, empty the group,
restore the trigger, sign in as `INITIAL_ADMIN_EMAIL`, confirm `bootstrap_admin_self_heal`
in the activity log and that `/admin` is reachable. Do not rehearse this in UAT: the state
it creates is the state the triggers exist to prevent.

### 10. Scope of v1 versus follow-up

The line is drawn at **the permission vocabulary is fixed; the bundles are not.** A checkbox
grid over a fixed five-value enum and a fixed three-value scope enum *is* a real permission
builder — admins compose arbitrary bundles from day one. What is deferred is everything that
changes the *shape* of authority rather than its assignment, because each of those items has
a blast radius of its own.

**In v1:** the four models and `SitePermission`; M1 and M2; `getActiveScopes` union; the
session include; the `guards.ts` rewrite and all six call-site conversions; the
`?screen=groups` UI and the user-detail groups panel; the seeded starter groups; all three
lockout layers; the audit events; the documentation updates in section 11.

**Deliberate follow-ups, each needing its own decision:**

1. **Retire `McpUserScopeGrant`** once group coverage is proven in UAT, collapsing scope to
   one source and removing risk 3.
2. **Restrict mintable `AgentToken` scopes** to the minter's own effective scopes, closing
   risk 4's second half.
3. **A default group for new users** (`Group.isDefaultForNewUsers`), replacing
   `grantDefaultScope`'s direct grant. Deferred because the first-login path is the single
   most dangerous function to change while also changing the model it writes into.
4. **Nested or inherited groups** — explicitly rejected for v1, no stated need, and
   transitive closure would make the lockout invariant much harder to prove.
5. **Row-level scoping** (a group seeing only one `DocumentSourceConnection`) — out of
   scope; the requirement is tool-level, and this would touch every tool query.
6. **Enforcing `User.status = DISABLED`** — a pre-existing Play 13 gap, not created here,
   but section 7 risk 9's doc update is in scope.

### 11. Files to change

**Schema and migrations**

- `prisma/schema.prisma` — add `SitePermission`, the four models, `User.groupMemberships`;
  remove `roles` / `Role` / `UserRole` / `RoleName` in the **M2** PR only.
- `prisma/migrations/<ts>_add_group_permissions/migration.sql` — M1 (section 6).
- `prisma/migrations/<ts>_drop_legacy_roles/migration.sql` — M2, **separate PR**.

**Server**

- `src/lib/server/mcp/scopes.ts` — `getActiveScopes` returns the union (section 4).
- `src/lib/server/auth/session.ts` — swap the `roles` include for `groupMemberships`.
- `src/lib/server/auth/guards.ts` — delete `isAdmin` / `requireAdminPage` /
  `requireAdminApi`; add `hasPermission`, `hasAnyPermission`, `requirePermissionPage`,
  `requirePermissionApi`; widen `hasGrantedScope`.
- `src/lib/server/auth/google.ts` — lowercase both sides of the `initialAdminEmail` compare.
- `src/routes/api/auth/google/callback/+server.ts` — `bootstrapInitialAdmin` ->
  `ensureBootstrapAdmin`, called on every login by that email, acting only when the protected
  group is empty (section 3 Layer 3). Keep its direct all-scopes grant on first-ever login
  unchanged.
- **Not changed:** `src/lib/server/mcp/handler.ts`, `src/lib/server/mcp/tools.ts`,
  `src/lib/server/mcp/oauthConfig.ts`, `src/lib/server/mcp/agentTokens.ts`,
  `src/routes/mcp/consent/+page.server.ts`, `Dockerfile.mcp`, `infra/`, `.github/workflows/`.

**Routes and UI**

- `src/routes/admin/+layout.server.ts` — gate on `hasAnyPermission`; keep the
  `admin_access_denied` audit write.
- `src/routes/admin/+page.server.ts` — per-action permission checks replacing the six
  `requireAdminApi` calls (`create`/`revoke` -> `AGENTS_MANAGE`; `disable`/`enable` ->
  `CLIENTS_MANAGE`; `inviteUser`/`grantScope`/`revokeScope` -> `USERS_MANAGE`); delete
  `grantAdmin` / `revokeAdmin`; add `createGroup`, `updateGroup`, `deleteGroup`,
  `grantGroupScope`, `revokeGroupScope`, `grantGroupPermission`, `revokeGroupPermission`,
  `addGroupMember`, `removeGroupMember` (all `GROUPS_MANAGE`, all with the section 3 guards);
  load groups with members and grants; return `permissionOptions` alongside the existing
  `scopeOptions`; omit the payload for screens the viewer may not see; add the two new
  `securityActions`.
- `src/routes/admin/+page.svelte` — add `{ key: 'groups', label: 'Groups' }` to `SCREENS`;
  render the groups screen (group list; create form; per-group permission and scope checkbox
  grids reusing the existing per-checkbox `<form>` pattern from the users screen; member
  add/remove; delete, hidden for `isSystem`); replace the users table's `Admin` column with a
  `Groups` chips column; hide tabs the viewer lacks permission for.
- `src/routes/admin/users/[id]/+page.server.ts` — replace the local `requireAdmin`
  (line 112) with `requirePermissionApi(..., 'USERS_MANAGE')`; load group memberships; return
  effective scopes with provenance (`direct` vs `via <group>`); add `addToGroup` /
  `removeFromGroup` actions gated on `GROUPS_MANAGE`.
- `src/routes/admin/users/[id]/+page.svelte` — replace the `Admin` badge with group chips;
  add a memberships panel and the provenance column.
- `src/routes/+layout.server.ts` — replace `isAdmin` with `canAdmin: hasAnyPermission(...)`;
  build `scopes` from the widened effective set.
- `src/routes/+layout.svelte` (line 22), `src/routes/+page.server.ts` (line 10),
  `src/routes/+page.svelte` (line 33), `src/routes/settings/+page.svelte` (lines 117, 138) —
  follow the `isAdmin` -> `canAdmin` rename.
- `src/routes/settings/+page.server.ts` — show effective scopes including group-derived ones,
  with provenance, so a user can see *why* they have access.

**Environment and infrastructure**

- **No new environment keys.** No change to `.env.example`, `web_secret_keys`,
  `mcp_secret_keys`, `MCP_OAUTH_SCOPES`, Terraform, or the workflows. The only existing key
  whose *semantics* change is `INITIAL_ADMIN_EMAIL` (already present in both `.env.example`
  and `web_secret_keys`), which becomes a standing break-glass rather than a one-shot.

**Documentation**

- `SECURITY.md` — add: site permissions come only from groups; the protected group and its
  invariant; `INITIAL_ADMIN_EMAIL`'s standing break-glass role; effective MCP scope is the
  live union of direct and group grants and must never be cached.
- `CLAUDE.md` — update the `McpScope` / scopes paragraph with a `SitePermission` sibling; add
  `groups` to the `/admin?screen=` list.
- `README.md` — line 55 (`/admin` screen list), line 56 ("Users, roles, sessions..."), and
  the "Adding the client's domain" recipe at 104-110.
- `playbook/10-uat-activation.md` — the first admin now lands in the `admin` group; the
  activity check is `bootstrap_initial_admin` plus the new membership event.
- `playbook/13-security-acceptance.md` — section 4 gains the permission matrix from section 9;
  known-gap row 90's remediation is rewritten (section 7 risk 9); row 98's case-sensitivity
  gap is closed.
- `playbook/14-*` — day-two recovery: what to do if `admin` is emptied or the group row
  is missing after a restore.

## Consequences

Positive: administration is delegable without handing over everything; the MCP scope surface,
the OAuth surface, `handler.ts` and every tool are untouched; the live-revocation guarantee
survives unchanged and is now provable by a specific pasted test; the dead `STAFF`/`VIEWER`
values disappear; recovery from the worst case no longer requires database surgery.

Negative and accepted: two sources of MCP scope until the follow-up retires direct grants;
two database triggers, an abstraction this repository does not otherwise use; one extra
indexed query on the MCP hot path; a destructive migration that must be sequenced across two
deploys by human discipline, since nothing enforces it; and `INITIAL_ADMIN_EMAIL` becoming a
permanently live recovery path rather than a one-shot.
