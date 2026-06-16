# Dependency Policy

## Pinning rules

- **Device-write libraries** (drive WebUSB ADB/Fastboot/EDL — they can brick devices on regression) are pinned to **exact versions** in `dependencies` and re-pinned via `overrides` so transitive copies cannot drift:
  - `@yume-chan/adb`
  - `@yume-chan/adb-credential-web`
  - `@yume-chan/adb-daemon-webusb`
  - `@yume-chan/stream-extra`
  - `android-fastboot`
- **All other deps** use tilde (`~`) ranges for patch-only auto-upgrades. Caret (`^`) is not allowed.

## Upgrade procedure for device-write libs

1. Check upstream changelog and release notes line-by-line.
2. Diff the published tarball against the pinned version (`npm diff`) — review every change touching USB transfer, fastboot protocol, or ADB framing.
3. Run the full E2E checklist (every supported model family) before merging the bump.
4. Update both `dependencies` and `overrides` in `package.json` together.

## Upgrade procedure for other deps

- Patch bumps land via routine dependency PRs.
- Minor/major bumps need a manual review — note any API surface changes affecting `src/`.

## CI gates

- `npm run audit:deps` runs `npm audit signatures` and `npm audit --omit=dev`. Treat any HIGH/CRITICAL as blocking.
- Lockfile (`package-lock.json`) is committed. Never delete or regenerate without intent.

## What lives outside `package.json`

- Build secrets (`ASSET_SIGNING_KEY_PEM`) are env-only, never committed.
- VPS deploy keys live outside the repo (see `deploy.ps1` header).
