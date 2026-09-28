# Production domain rollout

Approved mapping (2026-09-28):

| Host | Destination |
| --- | --- |
| alkemart.com | alkemart4-storefront Pages project |
| www.alkemart.com | Permanent HTTPS redirect to apex, preserving path and query |
| sell.alkemart.com | alkemart4-vendor Pages project |
| console.alkemart.com | alkemart4-admin Pages project, Access protected first |
| api.alkemart.com | alkemart-api Worker |

## Verified state

### Applied after credential update

- DNS access verified. Replaced the apex parking A record with the storefront
  Pages CNAME; added seller and console Pages CNAME records. Preserved all five
  Namecheap email-forwarding MX records and the SPF TXT record.
- Associated all three custom hostnames with their existing Pages projects.
- Extended the existing production Access application to console.alkemart.com;
  preserved its audience, pages.dev destination, two-email Google allowlist,
  one-hour session and independent MFA settings. Unauthenticated HTTPS requests
  to console return a 302 to the expected Cloudflare Access team.
- Attached api.alkemart.com to the existing alkemart-api Worker. No application
  code or authentication release was deployed.
- Replaced the www Namecheap parking CNAME with a separate Worker custom domain.
  The isolated infra/www-redirect Worker returns a 308 to HTTPS apex, preserving
  path and query. This is the only new code deployed during domain association.
- Pages validation/certificate activation was pending at initial verification;
  initial storefront and seller HTTPS requests returned 522. Do not treat a
  successful domain association as proof of healthy application delivery.
- Subsequent live HTTPS checks returned 200 for apex, seller, and API /health;
  www returned 308 with path/query preserved. Pages validation retry returned
  "Verification is in undefined status" even as live delivery succeeded; retain
  this was transient: final GET checks confirmed all three Pages domains have
  active domain, verification, and validation statuses.
- Isolated redirect tests cover encoded path/query preservation, HTTPS upgrade,
  port removal, and rejection of unrecognized hostnames.

The observations below describe the initial preflight, before token replacement.

- Cloudflare zone is active; registrar nameservers are no longer the blocker.
- The three Pages projects currently have no custom domains registered.
- Wrangler OAuth cannot list zone DNS records (HTTP 403). The privately supplied
  API credential is active and can read the existing Access applications, but
  also cannot list this zone's DNS records (HTTP 403).
- Existing production and preview admin Access applications retain the two
  approved emails, Google identity provider, one-hour sessions, and independent
  MFA configuration. No Access policy or domain routing was changed by this check.

## Safe execution order

1. Obtain zone-scoped DNS Read/Edit permissions and inspect existing records.
   Preserve mail MX/TXT and unrelated records; resolve only approved web-host conflicts.
2. Extend the existing production admin Access application to console.alkemart.com
   while retaining the pages.dev hostname, audience, Google allowlist, and MFA.
   Verify the protection before publishing the admin hostname.
3. Associate the Pages custom domains and attach the API Worker custom domain.
   Configure the www redirect with path/query preservation.
4. Verify public DNS, certificates, HTTP redirect behavior, and unauthenticated
   admin denial. Keep old deployment hosts during migration.
5. Separately deploy the reviewed application release with exact CORS origins,
   WorkOS callbacks/logout URLs, host-only secure cookies, and admin API Access
   assertion verification. Domain association alone does not enable these changes.

The unfinished authentication/security release has not been deployed. In
particular, the live legacy admin API bypass described in SECURITY-HARDENING.md
still requires its backend/proxy rollout. Do not describe domain setup as a
production security sign-off.

Never paste credentials into documentation or commit them. Supply replacement
credentials through the private file and revoke temporary tokens after use.

## Email (2026-09-28)

- **Receiving:** Cloudflare Email Routing enabled (route1-3.mx.cloudflare.net;
  root SPF `include:_spf.mx.cloudflare.net`). The five Namecheap placeholder
  MX records and their SPF were removed (the domain was new; Namecheap hides
  forwarding under custom nameservers, and no forwards had been configured).
- **support@alkemart.com:** rule `bca88b41fae94fdea1e824dd9efd7776` hands mail
  to the Email Worker `alkemart-support-mail` (`infra/support-mail`, deployed
  2026-09-28, version fb39db5a), which forwards a copy to each admin. A rule
  allows only one destination, hence the Worker. Destinations must be
  verified Email Routing addresses; mail bounces only if no copy is delivered.
- **DMARC:** `_dmarc` = `v=DMARC1; p=none; rua=mailto:support@alkemart.com`
  (monitor only). Tighten to `p=quarantine` after clean aggregate reports.
- **Sending (parked):** Resend domain `33238fea-40d8-4f2f-aa88-fb4f716820c4`
  (eu-west-1). Records on resend._domainkey, send and rsend only. Verification
  and the API key are pending; see the handoff runbook step 2.
