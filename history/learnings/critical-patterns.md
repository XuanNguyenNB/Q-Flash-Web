# Critical Patterns

## [20260618] Gate Frontend Deployment On Required Backend Health

**Category:** failure
**Feature:** q-flash-redesign
**Tags:** [deployment, backend, nginx, secrets, smoke-testing]

A successful static deploy can still publish a nonfunctional product when a required same-origin API is provisioned separately. Default deploys must verify service, secret/config, storage, and proxy readiness before upload, then validate the public API response shape after activation; intentional static-only releases need an explicit override.

**Full entry:** history/learnings/20260618-production-readiness-gates.md
