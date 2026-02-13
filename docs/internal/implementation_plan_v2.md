# Implementation Plan: Adversarial Engine v2 (Point-Scoring)

**Objective**: Replace the opaque K-Score system with a transparent, point-by-point debate system where specific claims are raised, defended, and adjudicated.

---

## 1. Core Data Structures (`src/types/debate.ts`)

We need a structured way to track the "War" of arguments.

```typescript
export type Severity = 'high' | 'medium' | 'low';
export type Winner = 'visionary' | 'skeptic';

export interface DebatePoint {
  id: string; // UUID
  lensId: string;
  
  // The Critique (Skeptic)
  critique: {
    claim: string;       // Concise one-line claim (e.g., "CAC will exceed LTV")
    reasoning: string;   // Detailed paragraph
    severity: Severity;  // Fatal flaw vs Friction
    source?: string;     // Citation or "Logic/Physics"
  };

  // The Defense (Visionary)
  defense?: {
    rebuttal: string;    // Direct counter-argument
    reasoning: string;   // Detailed paragraph
    source?: string;     // Citation or "Logic"
  };

  // The Verdict (Jury)
  verdict?: {
    winner: Winner;
    reasoning: string;   // Why the Jury awarded the point
  };
}

export interface LensResult {
  lensId: string;
  points: DebatePoint[];
  score: number; // 0-100 (Visionary Win Rate weighted by Severity)
  status: 'pending' | 'debating' | 'resolved';
}
```

---

## 2. Agent Workflow Logic & Prompt Engineering

To avoid generic "AI slop", each agent uses strict Persona Protocols.

### Step A: The Skeptic's Attack (`generateCritiquePoints`)
*   **Persona**: Ruthless VC Analyst / "The Mom Test" Auditor.
*   **Prompt**:
    > "You are The Skeptic. Your goal is NOT to be helpful; it is to kill bad ideas early to save capital.
    > Analyze the User's Proposal for the [LENS] lens.
    > Apply these filters:
    > 1. **The Mom Test**: Is this a "nice to have" or a "hair on fire" problem?
    > 2. **Unit Economics**: Does the math work? (CAC < LTV)
    > 3. **The Incumbent Test**: Why hasn't Google/Apple done this?
    >
    > Identify 3-5 distinct Failure Points.
    > - **Claim**: One concise sentence stating the fatal flaw.
    > - **Reasoning**: 2-3 sentences explaining the mechanics of failure.
    > - **Severity**: 'high' (Project Killer), 'medium' (Major Friction), 'low' (Optimization).
    >
    > Respond in strict JSON."

### Step B: The Visionary's Shield (`generateDefense`)
**Execution**: Iterate through each critique point. Call the Visionary Agent **independently** for each point.
*   **Persona**: "Zero to One" Founder / First Principles Thinker.
*   **Context**:
    1.  **Idea**: Refined Vision / Pitch.
    2.  **Lens**: The specific Thesis Lens being debated.
    3.  **Point**: The Single Critique Point (Claim + Reasoning).
*   **Prompt**:
    > "You are The Visionary. Defend against this SPECIFIC critique regarding [LENS].
    >
    > **The Attack**: "[CLAIM]" - [REASONING]
    >
    > **Your Task**:
    > 1. **Acknowledge** the validity of the risk.
    > 2. **Refute**: Explain the specific mechanism, logic, or secret data that neutralizes this risk.
    > 3. **Evidence**: Cite a historical comparable (e.g., 'Like Uber in 2011') or a specific First Principle.
    >
    > Respond with a single defense object in JSON."

### Step C: The Jury's Gavel (`adjudicatePoints`)
**Execution**: Iterate through each point (Critique + Defense). Call Jury Agent **independently**.
*   **Persona**: General Partner at Tier-1 VC Firm.
*   **Context**: Idea + Lens + Critique + Defense.
*   **Prompt**:
    > "You are the Investment Committee. Adjudicate this specific point of contention.
    >
    > **The Attack**: [CRITIQUE]
    > **The Defense**: [DEFENSE]
    >
    > **Verdict**:
    > - **Did the Visionary actually solve the risk?**
    > - If they used 'hope' (e.g., 'we will go viral'), they LOSE.
    > - If they provided a structural mechanism, they WIN.
    >
    > Output JSON: `winner` ('visionary' or 'skeptic') and `reasoning`."

---

## 3. UI Implementation Plan

### A. The Gauntlet UI (`src/pages/Gauntlet.tsx`)
*   **Replace**: Remove the generic `AdversarialChat` (scrolling chat).
*   **New Component**: `DebateTable`
    *   **Rows**: Each row is one `DebatePoint`.
    *   **Columns**:
        1.  **Point of Contention** (Skeptic's Claim + Severity Badge)
        2.  **Defense** (Visionary's Rebuttal)
        3.  **Verdict** (Winner Icon: 🛡️ used for Visionary, ⚔️ for Skeptic)
    *   **Expandable**: Clicking a row reveals the full "Reasoning & Sources" for both sides.

### B. The War Room UI (`src/pages/ProjectDetails.tsx`)
*   **Lens Detail**: Clicking a lens in the Heatmap opens a `Sheet` or Modal showing the `DebateTable` for that lens.
*   **Heatmap Calculation**:
    *   Score = `(Total Visionary Weighted Points / Total Weighted Points) * 100`
    *   *Weighting Strategy*: High Severity = 3pts, Medium = 2pts, Low = 1pt.

---

## 4. Execution Steps for Claude

1.  **Create Types**: Add `DebatePoint`, `Severity`, `Winner` to `src/types/database.ts` (or new file).
2.  **Update Agents**:
    *   Modify `src/lib/agents/gauntlet-agents.ts` to support the 3 specific functions (`attack`, `defend`, `judge`).
    *   Ensure strict JSON schema validation.
3.  **Build UI**:
    *   Create `src/components/DebateTable.tsx`.
    *   Update `Gauntlet.tsx` to use the new flow (Propose -> Attack -> Defend -> Judge).
4.  **Connect War Room**: Ensure the `DebatePoint` array is saved to the Manifest and loaded in the dashboard.
