# Story 7.6: ADB Scrcpy Integration (Screen Mirror MVP)

Status: completed

## Story

As a **user**,
I want **to view and control my device screen directly in the browser**,
so that **I can interact with the device without leaving the application**.

## Acceptance Criteria

1. **AC1**: ScrcpyPanel component displays screen mirror interface
2. **AC2**: Stream starts successfully with H.264/720p (MVP)
3. **AC3**: Video renders on Canvas using WebCodecs
4. **AC4**: Basic touch (Tap) works
5. **AC5**: Stop button cleans up resources
6. **AC6**: Error handling for connection failures
7. **AC7**: All text is translatable (EN/VI)

## Tasks / Subtasks

- [x] Task 1: Create ScrcpyPanel component (AC: 1, 2, 3, 4, 5)
  - [x] Create `src/components/features/adb/ScrcpyPanel.tsx`
  - [x] Implement server push logic
  - [x] Implement conservative options (H.264, 720p, 2Mbps)
  - [x] Implement WebCodecs decoder pipeline
  - [x] Implement Canvas renderer
  - [x] Implement basic touch (Tap) mapping

- [x] Task 2: Update ADB index exports (AC: 1)
  - [x] Verify export in `src/components/features/adb/index.ts`

- [x] Task 3: Update ADBPage layout (AC: 1)
  - [x] Ensure ScrcpyPanel is used in ADBPage

- [x] Task 4: Add i18n translations (AC: 7)
  - [x] Add English translations for `adb.scrcpy.*` keys
  - [x] Add Vietnamese translations for `adb.scrcpy.*` keys

- [x] Task 5: User verification
  - [x] Test with real device
  - [x] Verify latency and stability
  
> [!NOTE]
> For detailed documentation on the final implementation, see [ViewPhone Feature Documentation](../viewphone-feature-docs.md).

## Dev Notes

### Implementation Approach (Rebuild - KISS)

We rebuilt the integration from scratch to solve white screen issues:
1. **MVP Strategy**: Removed complexity (H.265, options, audio) initially.
2. **WebCodecs Only**: Removed TinyH264 fallback to simplify pipeline.
3. **Conservative Config**: Fixed 720p @ 30fps, 2Mbps bitrate.
4. **Server Push**: Direct push of `scrcpy-server.jar` from public folder.

### Tech Stack
- `@yume-chan/adb`
- `@yume-chan/adb-scrcpy`
- `@yume-chan/scrcpy-decoder-webcodecs`

### References
- [Plan: docs/scrcpy-rebuild-plan.md]
- [Story: docs/epics-usb-adb-fastboot.md#Story-7.6]

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-30 | Full MVP Rebuild Implementation | Dev Agent |
