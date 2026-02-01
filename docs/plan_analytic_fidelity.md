# Architecture Plan: Analytic Fidelity & Gap Report System

## Objective
Prioritize **Analytical Fidelity** over Instructional Compliance. The Agent must never fabricate facts to satisfy a template. If the input lacks the necessary "Atomic Unit" for a specific lens, the system must reject it with a **Gap Report** rather than hallucinating a mediocre proposal.

---

## 1. Architectural Change: The "Gap Report" Protocol

### The Workflow
**Input → Binary Check → Decision**

1.  **Path A (Pass)**: If the check passes, generate the **Proposal Draft**.
2.  **Path B (Fail)**: If the check fails, generate a **Gap Report**.

### Data Structure
The `generateLensProposal` function will no longer return a simple string. It must return a structured JSON object.

**Schema:**
```typescript
type LensProposalResult = 
  | { status: 'success'; content: string; }               // Mode A: Draft Proposal
  | { status: 'gap_detected'; gapReport: GapReport; };   // Mode B: Gap Report

interface GapReport {
  missing_element: string;           // The specific Atomic Unit missing (e.g. "Trigger Event")
  reason: string;                    // Why the input failed the Binary Check
  hypotheses: string[];              // 2-3 strategic pivots tagged with [HYPOTHESIS]
}
```

### Gap Report Requirements
-   **Explicit Failure Reason**: State clearly why it failed (e.g., "Target market is too broad").
-   **No Lubrication**: Do not attempt to "smooth over" the gap in a draft.
-   **Hypothesis Tagging**: Offer 2-3 specific strategic pivots tagged as `[HYPOTHESIS: Mechanism Name]`.

---

## 2. Specific Lens Updates (The Binary Routers)

### A. Engineering Lens
**Binary Check: Wrapper vs. Core** (Optimization vs. Breakthrough)

*   **Fail (Wrapper)**: Tech optimizes the transaction (booking, finding) but leaves unit economics unchanged (1-to-N).
    *   *Action*: **Gap Report** (Reclassify as Op-Ex).
*   **Pass (Core)**: Tech alters the physics/economics of delivery (marginal cost approaches zero).
    *   *Action*: **Draft Proposal**.

### B. Monopoly Lens
**Binary Check: Ocean vs. Pond** (Segment vs. Community)

*   **Fail (Ocean)**: Target is a demographic or broad category (e.g., "Gen Z", "Dog Owners").
    *   *Action*: **Gap Report**.
*   **Pass (Pond)**: Target is a specific, coordinated group (e.g., "Harvard Sophomores", "Upper West Side French Bulldog Club").
    *   *Action*: **Draft Proposal**.

### C. Timing Lens
**Binary Check: Trend vs. Trigger** (Curve vs. Step-Function)

*   **Fail (Trend)**: Rationale is "Market is growing" or "Adoption is up."
    *   *Action*: **Gap Report**.
*   **Pass (Trigger)**: Rationale is a distinct event (Law passed, API released) or a specific Threshold Crossing (Cost dropped below $X).
    *   *Action*: **Draft Proposal**.

### D. Distribution Lens
**Binary Check: Rented vs. Owned** (Paid vs. Viral/Embedded)

*   **Fail (Rented)**: Relies on Ads, SEO, or Sales Teams (CAC scales linearly).
    *   *Action*: **Gap Report**.
*   **Pass (Owned)**: Relies on Viral Loops or Product-Led Growth (CAC scales sub-linearly).
    *   *Action*: **Draft Proposal**.

---

## 3. Implementation Checklist for Claude

### Step 1: Types & Parsing Logic
- [x] Update `generateLensProposal` in `src/lib/agents/lens-protocols.ts` to expect and parse JSON.
- [x] Define the `LensProposalResult` and `GapReport` interfaces.
- [x] Implement error handling for JSON parsing failures (use `AIResponseParseError`).

### Step 2: Prompt Engineering (`src/lib/prompts/defaults.ts`)
- [x] Rewrite `PROPOSAL_PROMPTS` for **Engineering**:
    -   Add strictly defined "Wrapper vs Core" check instructions.
    -   Enforce JSON output format.
- [x] Rewrite `PROPOSAL_PROMPTS` for **Monopoly**:
    -   Add "Ocean vs Pond" check.
    -   Enforce JSON output format.
- [x] Rewrite `PROPOSAL_PROMPTS` for **Timing**:
    -   Add "Trend vs Trigger" check.
    -   Enforce JSON output format.
- [x] Rewrite `PROPOSAL_PROMPTS` for **Distribution**:
    -   Add "Rented vs Owned" check.
    -   Enforce JSON output format.
- [x] **Langfuse Visibility**: Prompts exported as `FALLBACK_LENS_PROPOSAL_*` constants and re-exported from `langfuse-prompts.ts`. Run `npx tsx scripts/export-langfuse-prompts.ts` to output prompts for Langfuse migration.

### Step 3: UI Updates (`src/pages/Gauntlet.tsx`)
- [x] Update `handleGenerateProposal` to accept the new structured response.
- [x] Add state handling for `gap_detected`.
- [x] Create a **Gap Report Card** component (or render condition):
    -   **Visual**: Warning color (Orange/Red).
    -   **Content**: Show `reason` and `missing_element`.
    -   **Interactive**: Render `hypotheses` as buttons. Clicking one populates the editor with the hypothesis.
    -   **Options**: "Edit Idea" (Back) or "Regenerate" button.

---

## 4. Verification Guide

1.  **Engineering Test (Wrapper)**:
    -   Input: "A mobile app to book dog walkers."
    -   Expected Result: **Gap Report** (Msg: "Wrapper detected. Optimizes transaction only.").
    -   Hypothesis: "[HYPOTHESIS: Autonomous Dog Drone]" (Something that changes unit economics).

2.  **Engineering Test (Core)**:
    -   Input: "A robotic dog walker that reduces cost by 90%."
    -   Expected Result: **Draft Proposal**.

3.  **Monopoly Test (Ocean)**:
    -   Input: "Social network for pet owners."
    -   Expected Result: **Gap Report** (Msg: "Ocean detected. Target too broad.").

4.  **Monopoly Test (Pond)**:
    -   Input: "Social network for owners of aggressive pitbulls in Austin, TX."
    -   Expected Result: **Draft Proposal**.
