# Approach - Q Flash Web Redesign

## Mode Gate

Mode: `high_risk_feature`

Why smaller modes are insufficient: this work changes the first user-facing product surface, responsive layout, production deployment, and proof expectations while preserving a safety-critical device workflow. It does not need backend or runner refactoring, but it does need careful validation and production smoke.

## Recommended Approach

1. Keep runtime behavior centered on `useUnlockWorkflow`; treat `App.tsx` as the main product/workspace composition layer.
2. Build a product-first page above the workspace with concise Vietnamese sections: purpose, supported flow, preparation, risks, supported models, and workspace entry.
3. Keep the unlock workspace visible and accessible through sticky navigation and clear CTA controls; preserve existing payment, preflight, compatibility, phase rail, progress, and terminal behavior.
4. Update focused UI tests for the redesigned product framing and preserved workflow affordances.
5. Validate in this order: focused tests, full tests, build with production asset base, local browser smoke/screenshots, then deploy and production smoke.

## Rejected Alternatives

- Multi-route marketing site: unnecessary for a static operational tool and increases routing/test scope.
- Rewriting workflow components around a new state model: too risky because the hook/runner already encode safety gates.
- Changing asset/payment/backend behavior while redesigning: violates the user constraints and expands deploy risk.

## Risk Map

| Component | Risk | Reason | Proof Needed |
| --- | --- | --- | --- |
| `src/App.tsx` composition | HIGH | User-visible rewrite can hide or disable critical controls | App tests, desktop/mobile browser smoke, manual layout inspection |
| `src/hooks/useUnlockWorkflow.ts` | LOW | Should not be changed for redesign | Diff review confirms no behavior edits unless bug found |
| Asset base/deploy | HIGH | Wrong env can break production asset loading | Production build output and production smoke check |
| Payment/backend surface | MEDIUM | Existing payment UI depends on `/api`; prior Khuym state notes production `/api` issue | Do not change contract; report smoke result and residual risk |
| Responsive layout | HIGH | Dense controls can overlap on mobile | Mobile screenshot and console inspection |

## File Boundaries

Likely runtime edits:

- `src/App.tsx`
- `src/style.css`
- `src/App.test.tsx`

Likely documentation/proof edits:

- `docs/product/q-flash-web.md`
- `docs/stories/q-flash-redesign/*`
- `history/q-flash-redesign/*`
- `.khuym/state.json`

## Validation Questions

- Does the first viewport clearly explain Q Flash Web and expose workspace entry within 30 seconds?
- Does the workspace still render payment, compatibility, preflight, phase, progress, and terminal controls from the same workflow state?
- Do desktop and mobile screenshots show no obvious overlap, clipped buttons, or unreadable dense text?
- Does the production build preserve the R2 asset base URL?
