# QFW-REDESIGN-001 Overview

## Current Behavior

Q Flash Web already exposes the unlock workspace, but the first experience is still weighted toward a dense technician console. A new user has to infer purpose, supported flow, preparation, and risks from scattered panels.

## Target Behavior

The production site opens as a polished Vietnamese product website with a clear introduction, compact flow explanation, preparation/risk guidance, supported model context, and direct entry into the unlock workspace. Existing WebUSB workflow behavior remains intact.

## Affected Users

- Xiaomi unlock technician.
- Shop operator preparing a supported device for service.

## Affected Product Docs

- `docs/product/q-flash-web.md`
- `docs/WORKFLOW.md`
- `docs/DEPLOY.md`
- `docs/ASSETS_R2.md`

## Non-Goals

- Changing payment/backend API contracts.
- Changing model support, R2 release paths, or destructive safety gates.
- Implementing a native EDL helper.
