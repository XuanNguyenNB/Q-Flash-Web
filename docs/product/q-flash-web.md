# Q Flash Web Product Contract

## Purpose

Q Flash Web is a Vietnamese WebUSB unlock workspace for supported Xiaomi devices. Its public product UI is branded as **Unlock Xiaomi**. It guides a technician through compatibility checking, asset preparation, payment/pass readiness, destructive confirmations, ADB/Fastboot/EDL operations, and final recovery guidance.

## Primary User

The primary user is a technician or shop operator who understands Xiaomi recovery workflows but needs a browser-based interface that reduces wrong-model and wrong-file mistakes.

## User-Facing Requirements

- The first screen must explain what Unlock Xiaomi does before presenting dense controls.
- The page must show the supported flow at a high level: connect Android/ADB, verify Fastboot, prepare verified assets, pay/authorize pass, run gated unlock phases, and finish with recovery guidance.
- The page must warn about data loss, brick risk, model mismatch, cable interruptions, and the need for the correct stock ROM or recovery plan.
- The unlock workspace must remain accessible on the same page and keep status, preflight, compatibility, payment, progress, and terminal surfaces visible.
- UI copy should be Vietnamese with accents; terminal-level logs may remain technical/ASCII.

## Non-Goals

- This contract does not change payment API behavior, backend deployment, R2 asset release paths, supported model metadata, or unlock phase semantics.
- This contract does not promise EDL WebUSB reliability beyond the current documented experimental state.

## Proof Expectations

- UI tests prove the product introduction and workspace controls render from mocked workflow state.
- Browser screenshots prove desktop and mobile layout quality.
- Production smoke proves the deployed static site and configured asset base load.
