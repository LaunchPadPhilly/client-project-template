# Play 03 — Google OAuth client

**Goal:** one Google Cloud OAuth 2.0 **Web application** client whose authorized redirect
URIs cover local, UAT and production, with the consent screen's User Type (Internal or
External + Published) deliberately chosen to match who is actually allowed to sign in.

**Needs:** Play 02 closed (you need the final hostnames).

## Steps

### 1. Project and consent screen (Google Cloud Console)

The choice below is **not just an app setting** — Google enforces it on its own servers
before any request reaches this codebase.

- **Internal (Workspace only)** — the template's design: only accounts inside the owning
  Workspace organization can even reach the consent screen. `GOOGLE_ALLOWED_DOMAIN` in the
  app is then a second, redundant lock. If **Internal** is not offered in the project you
  selected, that project is not inside a Workspace organization — stop and move to one that
  is, rather than falling back to External by accident.
- **External, published** — needed only if people outside the Workspace domain (personal
  Gmail included) must be able to sign in. Internal **cannot** allow this for any account,
  whatever the app's own checks say — Google rejects the sign-in at its own consent screen
  before the app's callback ever runs, which looks identical from the user's side to a bug
  in this app. Note the template itself still gates on the `hd` claim and
  `GOOGLE_ALLOWED_DOMAIN`, so admitting outside accounts is an app change as well, not just
  a console setting. Internal cannot be downgraded to External in place in every Workspace
  setup; if the project is already Internal, create the new OAuth client in a different
  (non-Workspace-restricted) project.

Confirm which one this deployment needs before continuing — it changes step 2's User Type
choice and whether step 1b applies.

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
non-test account fails sign-in with no error from this app at all; Google's own login page
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
| Sign-in rejected *after* Google consent, back at this app's login page | Account's Workspace domain is not in `GOOGLE_ALLOWED_DOMAIN`, or it is a consumer Gmail (no `hd` claim). This is the app's own gate — the request did reach it. |
| Sign-in rejected at **Google's own page**, before this app's login screen ever appears | External client still in **Testing** status — add the account under Test users, or finish step 1b and Publish App. Or the client is `Internal` and the account is outside the Workspace. Check this before assuming the app is broken; no app code ran at all. |
| `Internal` not available | Project is outside the Workspace organization. |
| Project's consent screen is already `Internal` and External access is needed now | Internal cannot be downgraded to External in place in every Workspace setup. Create the new OAuth client in a different Google Cloud project instead. |
| OAuth consent screen page is empty / prompts first-time setup | Wrong Google Cloud project is selected (top-left dropdown) — a project that already has this client would never show a first-time setup prompt. Switch projects; if the project owning this client isn't accessible from your account at all, you need a new client in a project you control. |
