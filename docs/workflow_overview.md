# Venture Forge: Workflow Overview

This document describes the user journey through the application, from raw idea to validated venture.

## 1. Stage 0: The Portfolio (Mission Control)
**Route**: `/` (Root)

The central hub for managing your venture portfolio.
-   **Dashboard**: Lists all ventures with their current status (Ideation, Debating, Resolved) and aggregate scores.
-   **Global Navigation**: Persistent sidebar to switch between ventures instantly.
-   **Quick Actions**: `Cmd+K` command palette to jump to any project or lens.

## 2. Stage 1: The Forge (Ideation & Inflation)
**Route**: `/forge/:id`
**Goal**: Transform a raw "shower thought" into a structured thesis using AI inflation.

-   **Split View Interface**:
    -   **Left (Raw Input)**: Unstructured user notes (e.g., "AI lawyer for startups").
    -   **Right (Inflated Vision)**: Real-time AI expansion of the concept into structured business logic (Thielian or General).
-   **Inflation Engine**: The AI identifies keywords and maps them to core venture concepts (Moat, Secret, Distribution).
-   **Commit**: When the thesis is stable, you proceed to **Framework Selection**.

## 3. Stage 2: Framework Selection (The Prism)
**Route**: `/forge/:id/framework`
**Goal**: Choose the specific "Gauntlet" configuration best suited for stress-testing this specific idea.

Venture Forge supports multiple evaluation frameworks:
1.  **Thiel / Zero to One (Default)**:
    -   **Focus**: Vertical Innovation, Secrets, Monopoly.
    -   **Lenses**: Engineering, Timing, Monopoly, People, Distribution, Durability, Secrets.
    -   **Best For**: Deep tech, contrarian bets, new categories.
2.  **Y Combinator**:
    -   **Focus**: Traction, Growth, "Make something people want".
    -   **Steps**: Idea Clarity, Market, Traction, Team, Unique Insight, Growth.
    -   **Best For**: Consumer apps, SaaS, rapid iteration.

## 4. Stage 3: The Gauntlet (Adversarial Analysis)
**Route**: `/gauntlet/:id`
**Goal**: Sequentially stress-test the venture against the selected framework's specific risk lenses.

### The Adversarial Loop (Per Lens)
Each step in the framework follows a rigorous debate protocol:
1.  **Identify**: The **Standard Bearer** agent proposes a "Steel-manned" thesis for this specific lens based on your Forge data.
2.  **Refine**: You edit the proposal to match your specific vision.
3.  **Debate**: You enter the **Adversarial Chamber**:
    -   **The Skeptic**: Attacks with specific failure modes (Physics, Market, Unit Economics).
    -   **The Visionary**: Defends based *only* on the facts provided (Grounding Rule).
    -   **The Jury**: Adjudicates the debate using a strict rubric.
4.  **Verdict**:
    -   **Lens Score**: A confidence score (0-100) calculated from the percentage of debate points won by the Visionary, weighted by severity.
    -   **Fatal Flaw**: If the Skeptic wins a **High Severity** point, the lens fails immediately (0 Score), regardless of other points.

## 5. Stage 4: The War Room (System of Record)
**Route**: `/projects/:id`
**Goal**: The single source of truth and strategic dashboard.

-   **Adaptive Heatmap**: A visual radar chart showing the status and score of each lens (adapts to the selected framework).
    -   **Green**: Resolved (High Confidence)
    -   **Amber**: Resolved (Low Confidence / Risks Detected)
    -   **Red**: Failed / Dirty (Needs Re-debate)
-   **Dependency Tracking ("Dirty State")**:
    -   If you modify an upstream assumption (e.g., change the "Target Customer" in the Forge), dependent downstream lenses (e.g., "Distribution") are automatically marked as **Dirty**.
    -   This forces intellectual honesty—you cannot change your premise without re-validating your conclusion.
-   **The Dossier**:
    -   **Competitor Matrix**: Auto-scouted threats and "Red Ocean" alerts.
    -   **Validation Lab**: "Mom Test" interview scripts and evidence logging.
