# QFW-REDESIGN-001 Design

## Domain Model

No domain model changes. The UI continues to consume `useUnlockWorkflow` state and `SupportedModel` metadata.

## Application Flow

The page stays a single React route:

1. Sticky top navigation summarizes readiness and exposes anchors.
2. Product introduction explains purpose, price, WebUSB requirements, and service boundaries.
3. Guided sections explain the sample flow, preparation checklist, risks, and supported devices.
4. Unlock workspace renders the existing control tower, control panel, compatibility/payment surfaces, progress, and terminal.

## Interface Contract

No API, route, or backend response contract changes.

## Data Model

No database or persistence changes.

## UI / Platform Impact

Desktop uses a product-first top section followed by a dense three-column workspace. Mobile stacks sections and workspace panels vertically with stable button sizes and scroll anchors.

## Observability

Existing terminal logs remain unchanged. Harness/Khuym trace files record proof and deployment evidence.

## Alternatives Considered

1. Add a router and separate landing/workspace pages. Rejected because same-page scroll entry is enough and avoids routing risk.
2. Refactor workflow UI into many new files. Deferred unless the single-file composition becomes unmanageable during implementation.
