# S1 Backend Override Authority - Overview

## Current Behavior

Q Flash Web currently has a frontend-only developer override path guarded by a Vite environment flag. The backend owns payments, passes, asset-key authorization, admin operations, and audit events, but it does not authenticate Developer Override sessions.

## Target Behavior

The backend owns Developer Override authority. An operator with the environment-only master key can start a 15-minute override session through an HttpOnly/Secure/SameSite cookie, check status, logout, and send sanitized override audit events. Wrong keys, missing configuration, expired sessions, and unauthenticated callers cannot unlock the override surface.

## Affected Users

- Developer/operator using a master key for controlled technical workflows.
- Normal technician using the paid unlock flow, whose payment/pass/asset-key behavior must remain unchanged.
- Future UI and runner stories, which will consume this backend session boundary.

## Affected Product Docs

- `history/developer-override-v2/CONTEXT.md`
- `history/developer-override-v2/current-story-pack.md`
- `docs/PAYMENTS.md`
- `docs/product/q-flash-web.md`

## Non-Goals

- Frontend Developer Override V2 panel.
- Resume, Selective Bypass, or Full Override runner behavior.
- New ADB terminal, EDL terminal, or EDL command support.
- Production deploy.
- Real-device or destructive command execution.
