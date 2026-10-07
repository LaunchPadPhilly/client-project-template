# 0001 — Google Drive connector via a self-authenticating service account

- Status: Accepted (design); implementation not started
- Date: 2026-09-16
- Scope: UAT only, client pilot
- Supersedes: the cancelled "OAuth Client ID impersonating a Penn user" approach

## Context

The client's Google Workspace tenant is administered by a third party. The originally planned
approach — our own OAuth Client ID, consented by an the client user — is cancelled and is
not reconsidered here: the tenant administrator will not allowlist our Client ID, drive/drive.readonly are
restricted scopes requiring Google verification plus a paid CASA assessment, and a
Testing-status consent screen caps refresh tokens at 7 days, which breaks unattended sync.

This is the repository's first connector. Verified against the tree at `aws_setup`:

- `src/lib/server/connectors/` does not exist. The "source → storage → MCP → interface"
  contract in `CLAUDE.md` is aspirational.
- `src/lib/server/auth/google.ts` is login-only (`openid email profile`), verifies the ID
  token with `jose`, and stores no Drive tokens. Nothing to strip.
- `prisma/schema.prisma` has auth/MCP-OAuth models only. No Document/Chunk/Embedding.
- `McpScope` is `DATA_READ`, `REPORTS_READ`; wire names map in `src/lib/server/mcp/scopes.ts`.
- `src/lib/server/mcp/tools.ts` holds one example tool, `service_status`.
- `Dockerfile.mcp` copies only an explicit subtree and already carries a comment
  instructing that each new connector directory be added to it.
- Infisical appears nowhere in the repository.
- `googleapis` / `google-auth-library` are absent from `pnpm-lock.yaml`; `jose` is present.
- ECS task definitions in `infra/modules/environment/ecs.tf` render no `environment`
  block — only `secrets` with per-key `valueFrom`. Every runtime value, sensitive or not,
  must travel through the flat-JSON secret.
- Task security groups already allow all egress, so `googleapis.com` is reachable with no
  infrastructure change.
- UAT sets `create_task_role = true`; the task role exists with no inline policy.
- `scripts/test.ts` treats every uncommented key in `.env.example` as required.
- `src/lib/server/mcp/oauthConfig.ts` lets `MCP_OAUTH_SCOPES` override the derived scope
  list, so a new scope not added to that secret value is never advertised.

## Decision

### 1. Authentication: a service account acting as itself

A service account in our own GCP project, Drive API enabled, scope
`https://www.googleapis.com/auth/drive.readonly`. No domain-wide delegation, no
impersonation, no consent screen, no Client ID registration, no third-party approval. the client
shares a folder with the service account's email exactly as they would with a person.
Service-account keys are not subject to the OAuth verification/CASA regime.

No new HTTP or SDK dependency. We mint the JWT bearer assertion with `jose`
(`importPKCS8` + RS256, audience `https://oauth2.googleapis.com/token`), exchange it at the
token endpoint for an access token, and call Drive REST v3 with `fetch`. This mirrors
`src/lib/server/auth/google.ts`, which already does raw `fetch` + `jose`. Adding
`googleapis` would introduce a second, much larger auth stack for no capability we need.
Access tokens are cached in-process with an expiry skew.

### 2. Credential storage: Infisical authors, Secrets Manager delivers

Chosen: an Infisical → AWS Secrets Manager sync. Rejected: the MCP task pulling from
Infisical at boot.

The service-account key JSON is authored and versioned in Infisical. A sync step writes it
into the existing `uat/<slug>/app` flat-JSON secret under one key. ECS injection,
`mcp_secret_keys`, the execution-role policy and task-definition rendering are unchanged.

Why not pull from Infisical at task start:

- It does not remove Secrets Manager. An Infisical machine identity would itself have to be
  bootstrapped from somewhere, so Secrets Manager stays in the path and a second system is
  added to it.
- It puts a third-party SaaS in the critical path of task start. A transient Infisical
  outage would stop the service scaling or deploying — an availability regression for a
  pilot, in exchange for no security gain.
- It requires a new SDK dependency, token-renewal logic, and makes the "how does this value
  reach the container" path no longer inspectable by the existing playbook.

Operational cost of the chosen option, stated plainly:

- The value now lives in two places. Rotation is a multi-step operation (rotate in
  Infisical, re-sync, redeploy both services). Nothing enforces that the two match — the
  same already-documented weakness as `web_secret_keys` versus the JSON.
- ECS resolves secrets at task start, so a rotated key reaches a service only on redeploy.
- The sync must become a recorded playbook step with pasted evidence, not tribal knowledge.

Scope limit: Infisical is adopted for this credential only. Making Infisical the
repository-wide secret store would touch every key in both environments, the secret
template, the playbook and CI. That is a materially larger decision with a much bigger
blast radius, is explicitly out of scope here, and needs its own ADR plus explicit human
sign-off. This ADR must not be cited as precedent for it.

### 3. Credential encoding: base64, one key

Stored as `GOOGLE_DRIVE_SA_KEY_B64` — base64 of the whole service-account JSON file.

Nesting raw JSON inside the flat-JSON secret would require double-escaping the newline
sequences inside `private_key`. `CLAUDE.md` already records two recurring
connection-string escaping faults; this is the same class of failure and is designed out
rather than documented. Base64 is single-line and safe in both the secret JSON and
`.env.local`. The value is decoded and parsed at first use, and never logged.

The service-account email is derived from the decoded `client_email`, so it needs no
separate key and cannot drift from the key actually in use.

### 4. Source-agnostic ingestion, because the share is untested

The Penn-tenant share has not been tested. If it is blocked, the fallback is a Google Apps
Script inside their tenant pushing files to an S3 prefix. Therefore parsing, chunking and
indexing must never see a Drive type.

```
src/lib/server/documents/        <- source-agnostic. MUST NOT import from connectors/
  types.ts      DocumentSource, SourceDocument, SourceFolder, SourceListing, PreflightResult
  ingest.ts     orchestrator: preflight -> listContents -> diff -> parse -> chunk -> persist
  diff.ts       read-only listing-vs-storage diff (added / updated / unchanged / removed)
  parse.ts      { bytes, mimeType, title } -> text
  chunk.ts      text -> ordered chunks
  log.ts        structured connector log events
src/lib/server/connectors/
  registry.ts   the ONLY module that knows both sides; builds a DocumentSource from env
  google-drive/ client.ts (SA JWT auth + Drive REST), source.ts, diagnose.ts
  s3-prefix/    source.ts (fallback, implemented only if the share is blocked)
```

The dependency arrow points one way: connectors import the contract; the contract never
imports a connector. `registry.ts` is the single seam.

Contract shape (design sketch, not final code):

- `SourceDocument` = sourceType, sourceId, title, mimeType, sizeBytes, remoteModifiedAt,
  contentHash, folderPath, parentFolderId, sourceUrl, and `fetchContent()`. `fetchContent` is lazy, so listing a large folder does
  not download it.
- `DocumentSource` = sourceType, `describe()`, `preflight()`, `listContents()`. The listing
  returns every folder (with its slash-joined path from the root) and every non-folder item
  in one walk, so storage can mirror the folder structure.
  `describe()` returns the principal (the service-account email); this is how requirement 3
  is satisfied everywhere rather than in one special-case log line.
- `preflight()` returns a discriminated union: ok | auth_failed | not_shared |
  shared_drive_membership_missing | unreachable.

Provider quirks are absorbed by the adapter. Native Google types
(`application/vnd.google-apps.document`) require `files/export`, not `files/get?alt=media`;
the Drive adapter normalizes them to a standard MIME type before handing bytes over, so
`parse.ts` only ever sees ordinary MIME types. Swapping in the S3 adapter changes
`registry.ts` and nothing downstream.

### 5. Data model

Migration required. Name: `add_document_ingestion_models`.

- `enum DocumentSourceType { GOOGLE_DRIVE S3_PREFIX }`
- `enum DocumentIngestStatus { PENDING FETCHED PARSED INDEXED FAILED SKIPPED }`
- `enum DocumentSyncOutcome { OK NOT_SHARED EMPTY AUTH_FAILED SHARED_DRIVE_MEMBERSHIP_MISSING PARTIAL FAILED }`
- `DocumentSourceConnection` — one configured source: sourceType, label, externalRef
  (folder id, or bucket+prefix), principal (SA email), lastPreflightStatus,
  lastPreflightAt, lastSyncStartedAt/CompletedAt. Unique on (sourceType, externalRef).
- `Document` — connectionId, sourceType, sourceId, title, mimeType, sizeBytes,
  remoteModifiedAt, contentHash, status, failureReason. Unique on (connectionId, sourceId).
- `DocumentChunk` — documentId, ordinal, text, tokenCount. Unique on (documentId, ordinal).
- `DocumentSyncRun` — per-run outcome and counts; the queryable record of the three states
  below.

Follow-up migration `add_document_folders_and_change_tracking` (additive only):

- `DocumentFolder` — one row per folder under the root: sourceId, name, path,
  parentSourceId, lastSeenAt, removedAt. Records empty folders too, so the structure is
  browsable without a live upstream call.
- `Document` gains folderPath (`""` is the root), parentFolderId, sourceUrl,
  lastIngestedAt, lastSeenAt and removedAt.
- `DocumentSyncRun` gains added, updated, unchanged and removed counts.

Sync is incremental. `diff.ts` classifies each listed file: added (no row, or a removed row
that reappeared), updated (md5 changed; for native Google files, which have no md5, the
modified time changed; or the last attempt did not reach INDEXED), or unchanged. Only added
and updated files are fetched. Unchanged files get their title and path refreshed in place,
so a rename or move needs no refetch. A stored file the listing no longer contains is marked
`removedAt` and its chunks are deleted, so search stops returning it. `--force` re-indexes
everything (for example after a parser change); `--dry-run` writes nothing.

The sourceType + sourceId discriminator is what keeps storage source-agnostic: an S3
document differs from a Drive document only in those two columns.

Embeddings are deliberately out of scope. There is no pgvector extension on this RDS
instance and enabling one is its own decision. v1 search is PostgreSQL full-text over
`DocumentChunk.text`, via `$queryRaw` with tagged-template parameters only, never string
interpolation.

### 6. Scope and MCP surface

New scope `DOCUMENTS_READ`, wire name `documents:read`. Per `CLAUDE.md` that is exactly two
code edits (the `McpScope` enum and the map in `scopes.ts`) plus a migration.

Keep the enum addition in its own migration, `add_documents_read_scope`, separate from any
data that uses the value. PostgreSQL rejects use of a newly added enum value inside the
same transaction that added it, and `prisma migrate deploy` runs a migration in one
transaction.

Tools appended to `mcpTools`, all read-only, all requiring `DOCUMENTS_READ`:

- `documents_search` — query text; returns matching chunks with document metadata.
- `document_get` — one document's metadata and extracted text.
- `document_source_status` — principal (SA email), last preflight status, last run outcome
  and counts. This is how an operator reads connector health through MCP.
- `document_folders_browse` — the folder structure and files as of the last sync: one
  folder's direct children, or everything beneath it with `recursive: true`.
- `document_source_changes` — lists the source live and diffs it against storage, returning
  what is new, updated, moved or removed since the last sync. It makes metadata GET requests
  only and writes nothing, so it stays within the read-only rule. It needs the Drive keys,
  which only the `mcp` container has; on the web fallback route it returns
  `available: false`.
- `document_charts` — the native charts in a document as exact data (type, titles,
  categories, every series value), so a client can redraw a chart and explain it instead of
  linking to it. Extracted at ingestion from the OOXML chart parts (`charts.ts`); Sheets and
  Slides arrive as xlsx/pptx exports and carry them. Values come from the chart's own cache,
  or from the referenced workbook cells when the cache is absent; `dataSource: 'missing'`
  marks a chart whose values the file does not hold (a pptx/docx chart without a cache).
  Stored in `DocumentChart` (migration `add_document_charts`); a text rendering is also
  appended to the chunks so search finds documents by what their charts show.
- `document_visuals` — the document as images, fetched live (read-only GETs) and rendered in
  the `mcp` process (`visuals.ts`): each page of a PDF or of a Slides/Docs deck exported to
  PDF, embedded pictures from pptx/docx/xlsx (and so Sheets), or an image file. This covers
  charts that exist only as pictures (Power BI and Qualtrics report exports). Images are
  downscaled to a 1568 px long edge and capped at 5 MB per response. Values read off a
  picture are approximate; `document_charts` is preferred when it has the chart.
  **PDFs:** a PDF holds no chart data, only drawing instructions, so its graphs are served
  as rendered pages. To find them, `analyzePdfFigures` scans pdf.js's operator list
  (without rendering) for three signals, each measured against the document's median
  page: raster images whose sampled pixels show color or variety (flat background panels
  and images repeated on half the pages don't count), colored vector shapes (charts use
  series colors; layout is gray and white), and, for gray-only content, a page far denser
  than typical (tables, monochrome charts). This was tuned on a real Qualtrics report
  where every page carries a gray full-width panel image and about 30 gray layout boxes:
  the first version flagged all 12 pages, and the current one flags only the chart page
  and the stats-table page. Known gap: a grayscale chart embedded as a picture is not
  detected, although it still renders when its page is requested. The result is
  stored on `Document` as `pageCount` and `figurePages` at ingestion, and recomputed live by
  `document_visuals`, which goes to those pages when no pages are requested (this also
  covers Slides and Docs exported to PDF). PDF text is stored with `[Page N]` markers, so a
  search hit names the page to look at. The detection is a heuristic that errs toward
  including a table with shaded rows rather than missing a chart.

`document_source_changes` and `document_visuals` are the only tools that call an upstream API.
`document_visuals` returns MCP `image` content through `richToolResult` in
`src/lib/server/mcp/handler.ts`; every other tool still returns one JSON text block. Page
rendering uses `@napi-rs/canvas` (the canvas pdf.js already depends on), imported lazily so
only a `document_visuals` call loads the native binary.

`documents_search`, `document_get`, `document_folders_browse`, `document_charts` and
`document_visuals` exclude removed documents.

**Citations.** The server sends MCP `instructions` at initialize (`mcpInstructions` in
`tools.ts`). They tell the client to put the source directly under each claim it takes from
a document: file title, folder, location, a Drive link, and a verbatim quote. Tool results
are citation-ready:
- `documents_search` returns `location` and `quote` for each hit instead of a highlighted
  snippet. The quote is an exact substring of the stored text (`citations.ts`), taken from
  around the matching words.
- `document_get` returns a `citation` block.
- `document_charts` and `document_visuals` attach a `citation` to each chart and image.

Locations come from inline markers written at parse time: `[Page N]` for PDFs, `[Slide N]`
for pptx and Slides, `[Sheet: name]` for xlsx and Sheets. A search hit takes the nearest
marker before it, or the last marker of an earlier chunk when a long page spans chunks.
Slide and sheet markers reach existing documents on the next `--force` ingest. Instructions
steer the client; they cannot force it.

**Power BI and Qualtrics links.** The parser keeps links from inside documents as
`anchor (URL)`. Links to Power BI or Qualtrics (powerbi.com, powerbi.microsoft.com,
qualtrics.com and their subdomains, including when wrapped in a `google.com/url?q=`
redirect or Outlook Safe Links) point at the live dashboards and surveys behind the
exported reports. They are withheld:
- `removeBlockedLinks` (`links.ts`) drops them at ingestion, so they are never stored.
- The same filter runs at read time in every tool, so documents ingested earlier are
  already clean before their next re-index.
- The instructions tell the client not to reconstruct them and to point to the exported
  report file instead.
- Every other embedded link is kept.
- The file's own Drive link (`sourceUrl`) is a citation and is never affected.

This replaced an earlier on/off admin switch for all embedded links, which never shipped.

**Charts by cohort and program.** Results such as session quality, the value of each
component and outcomes are spread across folders (Qualtrics reports, Power BI reports and
others). Before charting them, the client asks the user what to include:
1. `chart_filter_options` scans the library (`filters.ts`) and returns the topics, plus a
   numbered list of programs and cohorts. A program is the subfolder under a top-level
   folder (`Qualtrics reports/ECBI`). A cohort is "Cohort N" in the text or title, or a
   title code such as `C16S6`. Topics are matched by wording.
2. The client shows the numbered list, and the user picks any combination.
3. `chart_data` returns, for exactly those choices, verbatim excerpts with their location,
   native chart data, figure pages and citations. `coverage` reports which choices had data.
   `mixedCohorts` flags a combined report that covers chosen and unchosen cohorts together,
   so it cannot be split by cohort, and the client must say so.

The instructions require the chart to use only the chosen options and to carry a title
naming the filter. Everything is discovered from the ingested files rather than configured,
so a new program folder or cohort appears in the options after the next ingest.

The scope is checked in exactly one place, unchanged: `guardedToolResult` in
`src/lib/server/mcp/handler.ts`. Tools still register unconditionally.

Ingestion is not an MCP tool. It writes, so exposing it would break the non-negotiable
read-only rule. It runs as a one-off ECS task using the MCP image, which `Dockerfile.mcp`
designates as the image for idempotent data loaders that can reach the private RDS.

It runs hourly through EventBridge Scheduler (`infra/modules/environment/ingest-schedule.tf`,
enabled in UAT), and can also be run by hand (Play 14 section E):
- **Target.** A universal `ecs:runTask` target, because the templated ECS target cannot
  override the command. It runs the latest `mcp` revision with `tsx
  scripts/ingest-documents.ts`, never `--force`.
- **Writes.** A quiet hour writes only its sync record: unchanged documents and folders
  are not touched, and a rename or move writes only that row.
- **No overlap.** Runs are serialized by an atomic claim on the connection (`claimSync`).
  A run that finds another in progress returns `ALREADY_RUNNING`. A claim older than 30
  minutes counts as a crashed run and is taken over. A run that throws records `FAILED`.
- **Alerts.** Each run logs one `ingest.run` line with counts and outcome, never titles.
  CloudWatch metric filters on it, plus the scheduler's dead-letter queue, drive three
  alarms emailed to `ingest_alert_email`:
  - a run failed, partially failed or crashed;
  - no run has logged for three hours;
  - the scheduler could not start a task.

  The address is supplied at plan time and never committed.

### 7. Logging: three states that must be distinguishable from our logs alone

Constraint found by reading `handler.ts`: `toolResult` catches every error and returns the
fixed string "The requested data is unavailable." MCP tool responses therefore can never be
the diagnostic channel. Diagnostics go to stdout (CloudWatch, `awslogs` stream prefix
`mcp`) and to `DocumentSyncRun` rows surfaced by `document_source_status`.

Detection order in `preflight()`. This ordering is what makes the states separable:

1. Token exchange fails -> auth_failed. Distinguish bad key, clock skew and "Drive API not
   enabled" by Google's `error` code, logged as a code only.
2. `GET /drive/v3/files/{folderId}?fields=id,name,driveId,mimeType&supportsAllDrives=true`
   - 404 -> not_shared. Drive deliberately returns 404 rather than 403 for a resource the
     caller cannot see, so this is the not-shared signal.
   - 403 -> auth_failed, with the distinguishing reason code.
   - 200 with `driveId` present -> the folder is in a Shared Drive. Probe
     `GET /drive/v3/drives/{driveId}`; a 404 means the service account is not a member of
     the Shared Drive -> shared_drive_membership_missing. This is the silent failure:
     sharing the subfolder alone can appear to succeed while listing returns nothing.
   - 200 without `driveId` -> a My Drive folder shared directly -> ok.
3. List children with q = "'<folderId>' in parents and trashed=false" and BOTH
   `supportsAllDrives=true` and `includeItemsFromAllDrives=true`. Omitting either is an
   independent cause of a silently empty list on Shared Drives.
   - Zero results after a successful preflight -> empty (genuinely empty), never reported
     as not-shared.

Log events are single-line JSON with stable `event` names, always including `principal`
(the service-account email) so a human can act on any single line:

- `drive.preflight.ok` — principal, containerKind, containerId, containerName, driveId
- `drive.preflight.auth_failed` — principal, googleErrorCode, httpStatus
- `drive.preflight.not_shared` — principal, folderId, httpStatus; remediation text
  "Share folder <id> with <principal> as Viewer"
- `drive.preflight.shared_drive_membership_missing` — principal, driveId, folderId;
  remediation text "Add <principal> as a member of Shared Drive <driveId>; sharing the
  subfolder alone is not sufficient"
- `drive.sync.empty` — principal, folderId, containerKind, filesSeen 0
- `drive.sync.ok` — principal, filesSeen, ingested, failed

Never logged: the key, the JWT assertion, the access token, or raw Drive payloads.

### 8. Configuration keys

All of these go in `mcp_secret_keys` only, not `web_secret_keys`. The MCP image runs
ingestion; the web app has no need for the credential, and least exposure is preferred. If
an admin "sync now" button is added to the web UI later, that is when `web_secret_keys`
changes. Non-sensitive values still travel through the secret because the task definitions
render no `environment` block.

| Key | Sensitive | Purpose |
|---|---|---|
| `GOOGLE_DRIVE_SA_KEY_B64` | yes | base64 of the service-account JSON |
| `GOOGLE_DRIVE_FOLDER_ID` | no | the shared folder to ingest |
| `DOCUMENT_SOURCE_KIND` | no | `google_drive` or `s3`; selects the adapter in registry.ts |
| `DOCUMENT_SOURCE_S3_BUCKET` | no | fallback only; unset until needed |
| `DOCUMENT_SOURCE_S3_PREFIX` | no | fallback only; unset until needed |

In `.env.example` these are added commented out. `scripts/test.ts` treats every uncommented
key as required, so uncommenting them would break `pnpm run test` for every developer who
has no Drive credential.

`MCP_OAUTH_SCOPES` in the UAT secret must be updated to
"data:read reports:read documents:read". It overrides the derived list in `oauthConfig.ts`,
so leaving it alone silently withholds the new scope from discovery.

## Consequences

Positive: no dependency on tenant-admin action beyond a single folder share; no
Google verification or CASA cost; no 7-day token expiry; the ingestion layer survives a
switch to the S3 fallback without rework; the existing secret-injection architecture is
untouched.

Negative and accepted: the service-account key is a long-lived bearer credential with no
automated rotation; the credential exists in two systems; Infisical becomes a dependency
for one credential; a GCP project artifact must be maintained alongside the AWS estate.

## Risks

1. The Penn-tenant share is untested and is the largest risk. A Workspace admin can block
   sharing with principals outside the organization, and some tenants block service
   accounts specifically. If the share is refused at their end we observe not_shared
   indefinitely — indistinguishable from "they have not done it yet" from our side alone,
   because Drive returns 404 either way. Section 4's adapter seam exists precisely for
   this. the client must confirm whether the share UI succeeded or errored; do not infer
   tenant policy from our logs.
2. Infisical adoption blast radius. Contained to one credential by this ADR. Any proposal
   to widen it is a new decision requiring explicit sign-off.
3. Schema change requires a migration, therefore a blocking `prisma migrate deploy`
   run-task in the pipeline.
4. New MCP exposure: three new tools and one new scope. Read-only is preserved; ingestion
   is deliberately not a tool.
5. Stale tool lists: per `CLAUDE.md`, connected MCP clients keep the old tool list until
   they reconnect after the deploy.
6. Adding the S3 fallback later requires an inline policy on the UAT task role, which
   currently has none.

## Implementation status

- 2026-09-17: service account created — `<sa-name>@<gcp-project>.iam.gserviceaccount.com`,
  in the existing shared `<gcp-project>` GCP project (not a new dedicated project). No IAM
  role granted to it on that project, per section 1. Still to confirm before this account is
  used: the Google Drive API is enabled on `<gcp-project>`, and a JSON key has been
  generated for it. This email is the one to hand to the client for the folder/Shared-Drive
  share, and the one `document_source_status` (section 6) will report back as `principal`.
  Implementation (the connector code, migrations, Infisical wiring) has not started.
- 2026-09-28: folder structure and incremental sync (sections 4–6): `DocumentFolder`,
  per-document folder paths, change classification, `documents:ingest -- --dry-run`, and the
  `document_folders_browse` / `document_source_changes` tools. Motivation: Claude could not
  see the folder structure over MCP, and there was no way to ask whether anything had
  changed since the last ingestion short of re-ingesting everything.
- 2026-09-28: charts and visuals (section 6): `DocumentChart`, `document_charts`,
  `document_visuals`, image content in MCP results. Motivation: Claude could only give a
  link to a graph; it now gets the data behind native charts and can look at pictured ones,
  so it can redraw them and explain the data for qualitative reports. Charts in documents
  ingested before this change (and PDF figure pages and page markers) appear after one
  `documents:ingest -- --force` run.
- 2026-09-30: citations, withheld Power BI and Qualtrics links, and charts by cohort and
  program (section 6):
  - MCP server instructions and citation-ready tool results;
  - `[Slide N]` and `[Sheet: name]` markers;
  - `links.ts`, which blocks Power BI and Qualtrics links at ingestion and at read time;
  - `chart_filter_options` and `chart_data`, so the client asks which topic and which
    cohorts or programs before it builds a chart.

  Motivation: answers drawn from Drive should show their source and quote the passage
  they rely on; links to the live dashboards and surveys should not reach clients; and
  charts should follow the filter the user chose.
- 2026-10-01: hourly scheduled ingestion (section 6). EventBridge Scheduler runs the
  incremental ingest in UAT. Runs are serialized by an atomic claim, quiet hours write only
  their sync record, and three failure alarms are emailed. Motivation: new Drive files sat
  un-ingested because ingestion only ran when someone remembered to start it.
