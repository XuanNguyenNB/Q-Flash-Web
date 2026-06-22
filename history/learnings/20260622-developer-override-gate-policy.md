---
date: 2026-06-22
feature: developer-override-v2
categories: [pattern, decision, failure]
severity: standard
tags: [override-policy, safety-gates, audit, browser-qa]
---

# Learning: Keep Dangerous Override Modes As Policy Presets

**Category:** pattern
**Severity:** standard
**Tags:** [override-policy, safety-gates, audit]
**Applicable-when:** Adding operator-only bypass or recovery controls around existing dangerous workflow phases.

## What Happened

Developer Override V2 needed Resume, Selective Bypass, and Full Override without changing normal payment, asset-key, safety, or device-command behavior. The successful path added a typed `OverrideGatePolicy`, kept the default as `noOverrideGatePolicy`, and implemented Full Override by normalizing to every existing gate id instead of adding new protocol APIs. Tests then proved that bypasses skip gates but still require real device responses and prepared blobs.

## Root Cause / Key Insight

The risky part was not the UI selector; it was authority drift. If Full Override had grown a new terminal or protocol path, it would have bypassed both the backend session boundary and the existing runner truthfulness guarantees. Treating Full Override as a preset over the same runner gates kept the blast radius small and testable.

## Recommendation for Future Work

When adding a high-risk operator override, model it as an explicit policy object first, route every bypass through existing gate checks, and test the default no-override policy before testing bypass behavior. Do not add new command surfaces as part of an override mode unless the locked context explicitly approves the new protocol surface.

# Learning: Keep Browser QA Temp Profiles Outside Watched Repos

**Category:** failure
**Severity:** standard
**Tags:** [browser-qa, vite, windows, artifacts]
**Applicable-when:** Running local browser automation against a Vite dev server on Windows.

## What Happened

During mobile UI inspection, an isolated headless Chrome profile was first created under `.codex-run/developer-override-v2-s5/ui/`. Vite watched the workspace, hit a locked Chrome Safe Browsing cookie file, and crashed with `EBUSY`. The fix was to remove only the generated profile directories under the artifact root and rerun Chrome with its user data directory under `%TEMP%`, while keeping screenshots and JSON inspection outputs in `.codex-run`.

## Root Cause / Key Insight

Browser profiles contain locked files that file watchers should not traverse. Artifact folders are useful for screenshots and logs, but not for live browser profile directories when a dev server watches the repo.

## Recommendation for Future Work

When using local browser automation with Vite, store live browser user data dirs outside the repository, preferably under the OS temp directory. Keep only final screenshots, JSON inspection, and logs under `.codex-run`.
