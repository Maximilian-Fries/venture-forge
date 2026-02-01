# Bug Fix Plan: Inconsistency & Stability

**Status**: Identified
**Priority**: Critical

## 1. Project Leakage (The "Uber for Dogs has AeroMines data" Bug)
**Diagnosis**: The global state store (`useProjectManifest`) is likely not being cleared when navigating between projects, or `localStorage` keys are colliding.
**Fix**:
-   **Action**: Add a `useEffect` cleanup in `AppShell` or the detailed pages to call `clearProject()` on unmount/navigation.
-   **Validation**: Ensure `currentProject` is null before loading the new one.

## 2. Auto-Update Ghost Loops
**Diagnosis**: In `Gauntlet.tsx`, the "Auto-Continue" logic (e.g., `handleRunAttack` calling `handleRunDefense`) serves a purpose during a live run, but if a page is refreshed while in a 'defending' state, the component mounts and might auto-trigger the next step without user intent, or re-run an existing step.
**Fix**:
-   **Action**: Remove "Auto-Continue" from `useEffect` or mount. Only trigger via explicit `await` chains in the event handlers.
-   **Guard**: Ensure we check `if (state.status === 'defending' && !state.debatePoints)` before triggering a fetch. If points exist, DO NOT fetch.

## 3. The "Green Dot" Lie (Status Sync)
**Diagnosis**: `getVentureStatus` likely returns 'resolved' if `jury_verdict` exists from the *old* system, even if the *new* lenses are empty.
**Fix**:
-   **Action**: Update `getVentureStatus` to prioritize the **v2 Lens State**.
-   **Logic**: `if (lenses.some(l => l.status !== 'resolved')) return 'debating';`

## 4. Timeout & Latency
**Diagnosis**: `Promise.all` in `generateAllDefenses` waits for the slowest request. If one fails or hangs, the whole step hangs.
**Fix**:
-   **Action**: Add a `Promise.race` timeout wrapper (e.g., 60 seconds) to the API calls.
-   **UI**: Show a specific "Timeout - Retrying" error instead of indefinite spinner.

## 5. Execution Plan for Claude
1.  **Refactor `useProjectManifest`**: Add strict reset on load.
2.  **Fix `Gauntlet.tsx`**: Add "Idempotency Checks" (Don't run if data exists).
3.  **Fix `database.ts`**: Tighten `getVentureStatus` logic.
4.  **Update `gauntlet-agents.ts`**: Add timeouts.
