# S1 Backend Donation Authority - Overview

## Current Behavior

Q Flash Web has a payOS-backed paid unlock order flow. Backend orders are tied to a verified device serial/model, and marking an order paid issues an unlock pass. There is no donation domain, donation API, donation persistence, or donation admin surface.

## Target Behavior

The backend can create and track anonymous payOS donation records independently from unlock orders. A donation has an amount, status, provider identifiers, QR data, checkout fallback URL, and timestamps. Paid donations never create unlock passes, authorize asset keys, or affect workflow permission.

## Affected Users

- Visitor who wants to support the project without buying an unlock pass.
- Admin/operator reconciling payOS payments.
- Technician using the unlock workflow, whose payment/pass/key gates must remain unchanged.

## Affected Product Docs

- `docs/product/q-flash-web.md`
- `docs/PAYMENTS.md`
- `history/payos-donations/CONTEXT.md`

## Non-Goals

- Frontend donation UI and browser QR rendering.
- Public donor wall or public donation history.
- Donor names, messages, email, phone, receipt delivery, or accounts.
- Production deploy and smoke.
- Any unlock discount, pass, asset key, or workflow privilege from donation.
