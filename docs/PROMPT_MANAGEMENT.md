# Prompt Management Guide

This document outlines the workflow for managing prompts in MonopolyMap. **All prompts must be synchronized between the codebase and Langfuse.**

## Architecture

```
src/lib/prompts/defaults.ts    → Local fallback constants (FALLBACK_*)
src/lib/langfuse-prompts.ts    → Langfuse client + prompt fetching
Langfuse Cloud                 → Production prompts (source of truth at runtime)
```

## Golden Rule

> **When you modify a prompt, you MUST update BOTH:**
> 1. The local fallback in `src/lib/prompts/defaults.ts`
> 2. The Langfuse prompt (set to **Production**)

The local fallback ensures the app works if Langfuse is unavailable. Langfuse is the runtime source of truth.

---

## Prompt Naming Convention

| Type | Langfuse Name Pattern | Local Constant Pattern |
|------|----------------------|------------------------|
| Lens Proposal | `lens-proposal-{lensId}` | `FALLBACK_LENS_PROPOSAL_{LENS}` |
| Lens Visionary Protocol | `lens-protocol-visionary-{lensId}` | `VISIONARY_PROTOCOLS[lensId]` |
| Lens Skeptic Protocol | `lens-protocol-skeptic-{lensId}` | `SKEPTIC_PROTOCOLS[lensId]` |
| System Prompts | `gauntlet-{role}-system` | `FALLBACK_GAUNTLET_{ROLE}_SYSTEM` |

**Lens IDs:** `engineering`, `timing`, `monopoly`, `people`, `distribution`, `durability`, `secrets`

---

## Workflow: Adding or Updating a Prompt

### Step 1: Update Local Fallback

Edit `src/lib/prompts/defaults.ts`:

```typescript
// For a new prompt, add a FALLBACK_ constant
export const FALLBACK_LENS_PROPOSAL_NEWLENS = `Your prompt here...`;

// Then reference it in the appropriate dictionary
export const PROPOSAL_PROMPTS: Record<LensId, string> = {
  newlens: FALLBACK_LENS_PROPOSAL_NEWLENS,
  // ...
};
```

### Step 2: Export from langfuse-prompts.ts

Add to the imports and exports in `src/lib/langfuse-prompts.ts`:

```typescript
import {
  FALLBACK_LENS_PROPOSAL_NEWLENS,
  // ...
} from '@/lib/prompts/defaults';

export {
  FALLBACK_LENS_PROPOSAL_NEWLENS,
  // ...
};
```

### Step 3: Push to Langfuse

Run the push script:

```bash
npx tsx scripts/push-langfuse-prompts.ts
```

Or add the new prompt to the script first if it's not included.

### Step 4: Set to Production in Langfuse

1. Go to https://cloud.langfuse.com
2. Navigate to **Prompts** → Find your prompt
3. Click the version you just pushed
4. Click **"Set as Production"** (or toggle the production flag)

> ⚠️ **CRITICAL:** Prompts are only used at runtime if they are set to Production in Langfuse.

---

## Binary Check Prompts (Analytic Fidelity)

These four lenses use the Gap Report protocol with JSON output:

| Lens | Binary Check | Pass | Fail |
|------|--------------|------|------|
| Engineering | Wrapper vs Core | Tech changes unit economics | Tech is a layer on human labor |
| Timing | Trend vs Trigger | Discrete event/threshold | Gradual market growth |
| Monopoly | Ocean vs Pond | Coordinated group (directory test) | Demographic/broad category |
| Distribution | Rented vs Owned | Viral/PLG (CAC sub-linear) | Paid channels (CAC linear) |

These prompts return JSON in the format:
```json
{ "status": "success", "content": "..." }
// or
{ "status": "gap_detected", "gapReport": { "missing_element": "...", "reason": "...", "hypotheses": [...] } }
```

---

## Troubleshooting

### Prompt not updating at runtime
1. Check Langfuse cache TTL (15 minutes) - wait or call `invalidatePromptCache()`
2. Verify the prompt is set to **Production** in Langfuse
3. Check browser console for Langfuse fetch errors

### Fallback being used instead of Langfuse
1. Verify `VITE_LANGFUSE_PUBLIC_KEY` and `VITE_LANGFUSE_SECRET_KEY` are set
2. Check network connectivity to Langfuse
3. Look for warnings in console: `[langfuse-prompts] Failed to fetch...`

---

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/push-langfuse-prompts.ts` | Push all Binary Check prompts to Langfuse |
| `scripts/export-langfuse-prompts.ts` | Print prompts for manual copy-paste |

---

## Checklist for Claude/Agents

When modifying prompts:

- [ ] Updated local fallback in `src/lib/prompts/defaults.ts`
- [ ] Exported from `src/lib/langfuse-prompts.ts` (if new)
- [ ] Added to push script (if new)
- [ ] Ran `npx tsx scripts/push-langfuse-prompts.ts`
- [ ] Set prompt to **Production** in Langfuse UI
- [ ] Tested the change in the app
