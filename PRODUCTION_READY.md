# Production Readiness Checklist

Use this checklist before every production release. Mark items as completed and record any exceptions.

## Build and Quality Gates
- [ ] Install deps: `pnpm install`
- [ ] Lint clean: `pnpm lint`
- [ ] Typecheck clean (if enabled): `pnpm exec tsc --noEmit`
- [ ] Build succeeds: `pnpm build`
- [ ] Production start sanity check: `pnpm start`

## Functional Verification
- [ ] Core flows: create board, edit, save, and reopen
- [ ] Collaboration: multi-user cursors, edits, and conflict handling
- [ ] Export flows: image/PDF/JSON (if applicable)
- [ ] Offline or reconnect behavior (if supported)
- [ ] Browser sweep: latest Chrome, Firefox, Safari
- [ ] Mobile smoke test (iOS/Android)

## Performance and UX
- [ ] Lighthouse or Web Vitals pass (target thresholds defined below)
- [ ] Large board stress test (canvas performance, memory)
- [ ] Image asset optimization and compression
- [ ] No blocking console errors or warnings

### Web Vitals Targets
- [ ] LCP <= 2.5s
- [ ] INP <= 200ms
- [ ] CLS <= 0.1

## Security and Compliance
- [ ] Secrets not checked in; `.env` files excluded
- [ ] Dependency audit: `pnpm audit` (review critical/high)
- [ ] CSP, CORS, and secure headers validated (if configured)
- [ ] Auth rules reviewed (if any)
- [ ] Data retention and PII handling reviewed

## Data and Storage
- [ ] Backup/restore plan validated
- [ ] Migration steps documented (if schema changes)
- [ ] Storage limits and quotas verified

## Infrastructure and Deploy
- [ ] Env vars defined for production
- [ ] PartyKit deployment ready (schema and config valid)
- [ ] Static assets served via CDN (if applicable)
- [ ] Health checks and uptime monitor configured
- [ ] Rollback plan documented

## Observability
- [ ] Error tracking enabled (Sentry/Logflare/etc.)
- [ ] Logging levels set to production-safe
- [ ] Metrics or analytics enabled (if required)

## Release Management
- [ ] Version tag updated (if used)
- [ ] Changelog updated
- [ ] Release notes shared with stakeholders

## Notes / Exceptions
- [ ] Document any known issues, risks, or temporary exceptions
