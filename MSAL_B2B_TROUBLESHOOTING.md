# MSAL B2B Guest Auth — Troubleshooting Handoff

Record of work done on `feature/msal-b2b-auth` trying to enable B2B guest sign-in
from an external university (NUS) into a single-tenant Entra app.

## Goal
React (Vite) frontend + Spring Boot backend. Frontend uses MSAL to sign in B2B
guest users from an external university (`jun_yi_markteo@u.nus.edu`, home tenant
`5ba5ef5e-3109-4e77-85bd-cfeb0d347e82`) into a single-tenant Entra app in tenant
`nusiss-mtech-se-projects` (`e7fd6993-e646-4b0e-a981-d38362d2d061`).

## Persistent error
`AADSTS500208: The domain is not a valid login domain for the account type.`
Thrown by `handleRedirectPromise` → `validateAuthorizationResponse` in
`@azure/msal-browser`.

## Azure config (confirmed correct)
- **App Registration** (`peerconnect-frontend`, clientId
  `57cf3921-0d5b-4c96-9277-10a54818b823`)
  - SignInAudience = `AzureADMyOrg` (single tenant) — confirmed via an earlier
    650059 error.
  - Platform: SPA. Redirect URIs include `http://localhost:5173` / prod origin.
  - Expose an API: `api://<clientId>/access_as_user` scope added.
  - API permissions: Graph delegated `openid`, `profile`, `email`,
    `offline_access`, admin consent granted.
  - Token configuration: optional claims `email`, `upn`, `preferred_username`
    added.
- **Enterprise Application** (same app)
  - Enabled for users to sign-in: Yes.
  - Assignment required: No.
- **Guest user**
  - UserType: Guest, Identities: **ExternalAzureAD**, redemption Accepted,
    created in correct tenant.
- **Cross-tenant access settings**: unavailable (Entra ID Free tier, default
  allow-all applies).

## Frontend config
- `@azure/msal-browser` + `@azure/msal-react` in `src/AuthConfig.js`.
- Authority variations tried (see below).
- `redirectUri = window.location.origin` (matches registered
  `http://localhost:5173`).

## Things tried that did NOT fix it
1. Authority = `https://login.microsoftonline.com/{resourceTenantId}` → 500208.
2. Authority = `https://login.microsoftonline.com/organizations` → 650059 (app
   not in home tenant — expected, ruled out).
3. Reverted to tenant-specific authority after ruling out #2.
4. Verified guest redemption state (Accepted, ExternalAzureAD).
5. Verified tenant ID in `.env` matches the Entra tenant where guest was
   invited.
6. Verified Enterprise App sign-in enabled / assignment not required.
7. Incognito browser sessions (ruled out stale cache/session).
8. Added `domainHint: "u.nus.edu"` + `prompt: "select_account"` to
   `loginRedirect`.
9. Reduced scopes from `["openid","profile","email"]` to `["openid"]` to avoid
   Graph email-claim resolution.

## Sign-in log data (from Entra)
- Status: Failure, Error 500208.
- User type: Guest, Cross-tenant access type: B2B collaboration.
- Resource: **Microsoft Graph** (`00000003-0000-0000-c000-000000000000`).
- Resource tenant: `e7fd6993-...` (ours). Home tenant: `5ba5ef5e-...` (NUS).
- **Incoming token type: SAML 1.1** ← unusual; suggests NUS federation returns
  a SAML 1.1 token.
- Authentication Details tab: empty (failure happened before MFA/CA
  evaluation).
- Additional Details: `Domain hint present: True`.

## Current hypotheses (unverified)
- **SAML 1.1 incoming token** from NUS may be the root cause — modern Entra B2B
  normally uses Entra-to-Entra trust, not SAML 1.1. Something about how NUS
  federation is configured may be incompatible with this B2B flow.
- **Guest user access restrictions** in External Collaboration Settings — not
  yet verified.
- Possible **dual-identity (MSA + work account)** on the same email — not
  verified.

## Suggested next diagnostics
- Invite a guest from a **different tenant** (e.g., a personal Outlook or
  another Azure AD org) — isolates whether the issue is NUS-specific or
  generic B2B.
- Check **External Identities → External collaboration settings → Guest user
  access** restriction level.
- Run the **Sign-in Diagnostic** link from the failed log entry — Microsoft's
  tailored troubleshooter.
- Raise a Microsoft support ticket with the Correlation ID
  `019d8709-f93a-71b5-bd28-16a7ea27d02b`.
