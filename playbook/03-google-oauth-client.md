# Play 03 — Google OAuth client

**Goal:** one Google Cloud OAuth 2.0 **Web application** client whose authorized redirect
URIs cover local, UAT and production, with the consent screen's User Type (Internal or
External + Published) deliberately chosen to match who is actually allowed to sign in.

**Needs:** Play 02 closed (you need the final hostnames).

## Steps

### 1. Project and consent screen (Google Cloud Console)

Two designs are possible here, and the choice is **not just an app setting** — Google
enforces it on its own servers before any request reaches this codebase.

- **Internal (Workspace only)** — the original design: User type **Internal**, so only
  accounts inside the owning Workspace organization can even reach the consent screen.
  `GOOGLE_ALLOWED_DOMAIN` in the app is then a second, redundant lock. If **Internal** is
  not offered in the project you selected, that project is not inside a Workspace
  organization — stop and move to one that is, rather than falling back to External by
  accident.
- **External, published** — required if admins need to invite people outside the
  Workspace domain (personal Gmail accounts included) via `/admin`'s "Invite a user" (see
  `docs/decisions/0002-group-based-access-control.md`). Internal **cannot** do this at
  all, for any account, regardless of what `GOOGLE_ALLOWED_DOMAIN` or the invite list say
  — Google rejects the sign-in attempt at its own consent screen before our callback ever
  runs, which looks identical from the user's side to a real bug in this app and is easy
  to chase in the wrong place for a while. If the project is already Internal and this
  access model is wanted, a new OAuth client in a different (non-Workspace-restricted)
  project is the fix — Internal cannot be downgraded to External in place in every
  Workspace setup.

Confirm which one this deployment needs before continuing — it changes step 2's User Type
choice and whether step 1b below applies.

1. Select or create the Google Cloud project.
2. **APIs & Services → OAuth consent screen** (or, in the newer console layout, **Google
   Auth Platform → Audience**). Set the User Type decided above. App name = display name.
   Scopes: none beyond the defaults (`openid`, `email`, `profile`). Save.

**1b. External only — publish it.** A new OAuth client starts in **Testing** status, which
restricts sign-in to an explicit "Test users" allowlist in this same console — independent
of, and in addition to, anything this app's own code checks. Under **Branding**, fill in
App name, a support email, and developer contact email (logo/homepage/privacy/terms are
usually optional), then **Publish App** under Audience. Because this client only requests
non-sensitive scopes (`openid email profile`), publishing does not trigger Google's
manual-verification review — it takes effect immediately. Skipping this step means every
invited account fails sign-in with no error from this app at all; Google's own login page
simply refuses them.

### 2. Create the client

**APIs & Services → Credentials → Create credentials → OAuth client ID.**
Application type **Web application**. Authorized redirect URIs, exactly:

```text
http://localhost:5173/api/auth/google/callback
https://uat.<domain>/api/auth/google/callback
https://<domain>/api/auth/google/callback
```

Download or copy the **client ID** and **client secret**. Put the secret nowhere yet
except a password manager. It goes into `.env.local` (Play 04) and the AWS secret
(Play 09).

### 3. Evidence

Paste the client ID (it is public by design) and the three redirect URIs as they appear
in the console, one per line.

**EVIDENCE 03.1**
**Accept when:** the client ID ends in `.apps.googleusercontent.com`; the three URIs match
the block above byte for byte (scheme, host, path, no trailing slash). Consent screen User
Type stated as `Internal`, or as `External` with Publishing status `In production`.

Never paste the client secret.

## Success criteria

- [ ] 03.1 accepted
- [ ] Client secret stored in a password manager, not in any file yet

## Failure modes

| Symptom | Cause / fix |
|---|---|
| `redirect_uri_mismatch` at login (later plays) | The URI in the console differs from `GOOGLE_REDIRECT_URI` in the environment. Compare byte for byte. |
| Sign-in rejected *after* reaching this app's `/login?status=not_allowed` | Account's domain is not in `GOOGLE_ALLOWED_DOMAIN` and the email was never invited (see ADR 0002). This app's own gate — the request did reach us. |
| Sign-in rejected at **Google's own page**, before this app's login screen ever appears | External client still in **Testing** status — add the account under Test users, or finish step 1b and Publish App. Check this before assuming the app's invite logic is broken; it looks the same from the user's side as a real bug here, but no app code ran at all. |
| `Internal` not available | Project is outside the Workspace organization. |
| Project's consent screen is already `Internal` and External access is needed now | Internal cannot be downgraded to External in place in every Workspace setup. Create the new OAuth client in a different Google Cloud project instead (see Play 14 section M for the matching Drive-service-account situation, which has the same "wrong project" shape). |
| "Looking for the OAuth consent screen page and it's empty / prompts first-time setup" | Wrong Google Cloud project is selected (top-left dropdown) — a project that already has this client would never show a first-time setup prompt. Switch projects, or if the project owning this client isn't accessible from your account at all, that confirms you need a new client in a project you do control. |
