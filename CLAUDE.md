# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server on port 8080
npm run build    # Production build
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

### Database & AI
- **Supabase CLI** for database migrations
- **Gemini 3 Pro** as the primary reasoning engine for agent responses

## Core Philosophy

MonopolyMap is built on Peter Thiel's "Zero to One" framework. The central question: **Is this idea "0 to 1" (category creation) or "1 to N" (incremental improvement)?**

### The Secret
Every great business is built around a contrarian truth hidden from others. If a founder can't articulate their "Secret", the idea scores low. The Secret answers: "What do you believe that most people disagree with?"

### The Wedge
Start with a small, specific market and dominate it completely before expanding. This prevents "Boiling the Ocean" syndrome. The Wedge tracks the narrow focus and expansion path to monopoly.

### The Venture Jury (Adversarial Debate)
Ideas are stress-tested through structured adversarial debate, not simple analysis:
1. **Visionary** defends the 10x breakthrough potential, must cite `[GROUNDING: "..."]` from the pitch for every claim
2. **Skeptic** attacks with physics-based razors; each claim must target a unique variable (Variable Isolation Protocol)
3. **GP Jury**: Cynical auditor — GROUNDING TEST and VAGUE BAN are the two highest-priority checks; Skeptic wins by default (Burden of Proof)

### The Venture Manifest
A structured JSON object serving as the single source of truth. Contains: `core_thesis` (the Secret + 0-to-1 logic), `wedge` (target audience + expansion path), `engineering_moat`, `timing_risks`, and `jury_verdict`. All agents read from and contribute to this manifest.

## Architecture

Built with Vite + React + TypeScript + shadcn/ui + Tailwind CSS.

### Agent Personas & Analytic Fidelity Protocol
Defined in `src/lib/prompts/defaults.ts`. Prompts use an **OS + Cartridge** architecture:
- **OS layer** (`FALLBACK_GAUNTLET_*_SYSTEM`): Structural enforcement rules (format, dedup, grounding). Lens-agnostic.
- **Cartridge layer** (`VISIONARY_PROTOCOLS`, `SKEPTIC_PROTOCOLS`): Lens-specific subject expertise loaded per debate.

Agent roles:
- **Visionary**: Defends with Evidence Mandate — every claim needs `[GROUNDING: "exact quote"]` from the pitch. Unearned Asset Rule forbids claiming capabilities beyond input fidelity.
- **Skeptic**: Attacks with unique-variable claims (Variable Isolation Protocol + Self-Audit). Business filters (Mom Test, Incumbent Test) live in cartridges, not the OS.
- **Jury**: Applies Rubric of Death in strict order — GROUNDING TEST (#1) and VAGUE BAN (#2) override all qualitative arguments. Burden of Proof defaults to Skeptic.
- **Investigator** (Rob Fitzpatrick): Generates Mom Test questions about past behavior, never future intentions

### Analysis Flow
1. **Pitch Phase**: User enters idea (`NewIdea.tsx`)
2. **Wizard Phase**: 7-lens analysis (Engineering, Timing, Monopoly, People, Distribution, Durability, Secrets) with Visionary vs Skeptic debates (`LensWizard.tsx`)
3. **Validation Phase**: Investigator generates Mom Test questions (`MomTestLab.tsx`)
4. **Complete Phase**: Final Monopoly Score and Contrarian Index

### Key Components
- `LensWizard`: Multi-step wizard managing the 7-lens debate flow
- `DebatePanel`: Side-by-side Visionary vs Skeptic output
- `ConflictToggle`: User votes on debate winner (affects scoring)
- `MomTestLab`: Customer validation question generator
- `MonopolyChart` / `ContrarianIndex`: Score visualizations

### Scoring
- **Monopoly Score**: Weighted from user choices across all lens debates
- **Contrarian Index**: (engineering + secret scores) / 2 - (skeptic flags * 5)
- **Wedge Percent**: Calculated market wedge size

### Styling
- Dark theme with CSS variables in `src/index.css`
- Agent colors: `visionary` (cyan), `skeptic` (orange), `investigator` (green)
- Glass morphism: `.glass-panel`, glow effects: `.glow-primary`, `.glow-skeptic`

### Path Alias
`@/` maps to `./src/`

## Prompt Management (IMPORTANT)

**All AI prompts must be synchronized between the codebase AND Langfuse.**

See `docs/PROMPT_MANAGEMENT.md` for the full workflow. Key points:

1. **Local fallbacks** live in `src/lib/prompts/defaults.ts` (as `FALLBACK_*` constants)
2. **Langfuse** is the runtime source of truth
3. When modifying prompts:
   - Update the local fallback
   - Run `npx tsx scripts/push-langfuse-prompts.ts` to push to Langfuse
   - **Set the prompt to Production** in Langfuse UI

### Binary Check Lenses (Analytic Fidelity)
Four lenses use strict binary validation before generating proposals:
- **Engineering**: Wrapper vs Core (is tech the product, or a layer on human labor?)
- **Timing**: Trend vs Trigger (gradual growth vs discrete event)
- **Monopoly**: Ocean vs Pond (broad demographic vs coordinated group)
- **Distribution**: Rented vs Owned (linear CAC vs viral/PLG)

If validation fails, a **Gap Report** is returned instead of a proposal.

### Skeptic Cartridge Highlights
Business filters from the old Skeptic OS are placed in the cartridges where they belong:
- **Engineering**: 3 physics-based razors (Textbook Test, Commodity Check, Substitute Test). No business filters — pure tech moat analysis.
- **Monopoly**: Mom Test in Atomic Pain Traps (problem severity), Incumbent Test in Secret Traps (why hasn't BigCo done this?).
- **Distribution**: Incumbent Test in Wedge-Channel Traps (can BigCo outspend on this channel?).

## Implementation Docs
See `docs/implementation_plan/` for:
- `01_manifest_architecture.md`: Venture Manifest JSON schema
- `02_adversarial_agent_logic.md`: Venture Jury debate flow
- `03_technical_roadmap.md`: Threaded chat workspace plans
