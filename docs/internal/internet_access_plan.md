# Real-Time Internet Access & Competitor Analysis Plan

## 1. Real-Time Internet Access for Agents
**Objective**: Enable agents (Skeptic, Visionary) to access real-time market data via Google Search Grounding to validate claims against current reality rather than just internal logic.

### Google Search Grounding Integration
- **File**: `src/lib/agents/gauntlet-agents.ts`
- **Action**: Update the `getModel` function to support the `googleSearchRetrieval` tool configuration.
- **Requirement**:
    - Ensure the API key has the Search entitlement.
    - Add a `useSearch` flag to the `getModel` function to toggle this feature per-agent or per-step (e.g., enabled for Skeptic Attack, disabled for simple formatting tasks).

### Agent Configuration
- **Skeptic**: Enable search to find prior failures, existing competitors, and physics limitations.
- **Visionary**: Enable search to find supporting research, successful pivots, and market trends.
- **Jury**: Enable search to verify factual claims made by either side.

---

## 2. Competitor Analysis Module ("The Scout")
**Objective**: A dedicated agent that actively hunts for competitors to validate the "Monopoly" and "Blue Ocean" claims, populating a structured Competitor Matrix.

### The Competitor Scout Agent
- **File**: `src/lib/agents/competitor-agent.ts`
- **Role**:
    - Takes the `Wedge` and `Core Thesis`.
    - Searches for existing solutions and categorize them: "Direct", "Adjacent", "Status Quo".
- **Output**: Returns a `CompetitorReport` JSON.

### Integration: The "Market Validity" Check
- **Where**: Triggered automatically during the **Monopoly Lens**.
- **Logic**:
    - If the user claims "No one is doing this," the Scout runs a "Sanity Check."
    - If Scout finds >3 direct competitors, warn the user with a "Red Ocean" alert.

### UI: Competitor Matrix
- **File**: `src/components/CompetitorMatrix.tsx` (or inside `ProjectDetails.tsx`)
- **Display**:
    - A dedicated "Competitors" tab in the War Room.
    - Column 1: "User Identified" (Manual entry).
    - Column 2: "Scout Detected" (AI suggestions).
    - Action: "Add to Matrix" button for detected rivals.
