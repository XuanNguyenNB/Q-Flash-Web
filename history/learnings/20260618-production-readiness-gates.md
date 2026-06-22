---
date: 2026-06-18
feature: q-flash-redesign
categories: [pattern, decision, failure]
severity: critical
tags: [deployment, backend, nginx, secrets, smoke-testing]
---

# Learning: Gate Frontend Deployment On Required Backend Health

**Category:** failure
**Severity:** critical
**Tags:** [deployment, backend, nginx, secrets, smoke-testing]
**Applicable-when:** A static frontend depends on a same-origin API or service that is deployed separately.

## What Happened

The redesigned static site deployed successfully, but `https://unlock.choimaytau.com/api/health` still returned SPA HTML because the VPS had no `qflash-payments.service`, no `/etc/qflash-payments.env`, no `/var/lib/qflash-payments`, and no Nginx `/api` proxy. The original deploy script treated the missing service as a warning and still printed `Deploy complete!`.

## Root Cause / Key Insight

Build success and static page smoke do not prove an application release when a required same-origin backend is independently provisioned. A deploy command must distinguish intentional static-only publication from a complete product release and validate the public API contract after activation.

## Recommendation for Future Work

When a frontend requires a production API, make the default deploy path fail before upload unless service, secrets/config, storage, and reverse-proxy prerequisites are present. Require an explicit static-only override, and postflight the public health endpoint for JSON shape rather than status code alone.
