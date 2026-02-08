# The Gauntlet Mechanics: How Ideas Die

This document details the internal logic of the Venture Forge "Gauntlet" – the adversarial debate engine that stress-tests startup ideas.

## 1. The Point-Scoring System
Unlike generic AI "feedback" that gives a fuzzy summary, the Gauntlet uses a deterministic **Point-Scoring Debate System**.

### The Flow
1.  **Skeptic Attack**: The Skeptic agent generates $N$ specific failure points (usually 3-5).
2.  **Visionary Defense**: The Visionary agent defends each point individually.
3.  **Jury Verdict**: The Jury agent reviews each pair (Attack vs. Defense) and awards the point to either the Skeptic or the Visionary. **There are no draws.**

### Scoring
The final score for a lens is calculated based on the percentage of points won by the Visionary.
$$ \text{Lens Score} = \frac{\text{Visionary Wins}}{\text{Total Points}} \times 100 $$

---

## 2. The "Fatal Flaw" Rule (One Strike Policy)
To prevent "nice-to-have" ideas from passing simply by winning minor arguments, the system enforces a strict **Severity** check.

### Severity Tiers
The Skeptic assigns a severity to each attack point:
*   **High (Fatal)**: A structural impossibility or "project killer" (e.g., "Physics says this is impossible," "Unit economics are negative").
*   **Medium (Friction)**: A major hurdle that requires a specific mechanism to solve.
*   **Low (Optimization)**: A minor issue that can be fixed with iteration.

### The Rule
> **If the Skeptic wins even ONE High-Severity point, the mechanism triggers an immediate FAILURE, regardless of the total score.**

This mimics the reality of startups: you can get 9 things right, but if you run out of money (High Severity), the company dies.

---

## 3. The Gap Report System
The "Gap Report" is the failure state UI. It blocks the user from proceeding until they fundamentally pivot their idea.

### Triggers
A Gap Report is triggered in two scenarios:

#### A. Pre-Debate (The Binary Check)
Before the debate even starts, the system checks for "Category Errors."
*   **Engineering**: Checks for "Wrapper vs. Core" (Is this just a feature?).
*   **Monopoly**: Checks for "Ocean vs. Pond" (Is the target too broad?).
*   **Timing**: Checks for "Trend vs. Trigger" (Is the timing specific?).
*   **Distribution**: Checks for "Rented vs. Owned" (Is the growth viral?).

If the initial idea fails this check, a Gap Report is issued immediately.

#### B. Post-Debate (The Jury Verdict)
If the **Fatal Flaw Rule** (see above) is triggered during the debate:
1.  The system identifies the specific High-Severity point(s) lost.
2.  It synthesizes a **Post-Mortem Gap Report** explaining exactly why the defense failed.
3.  It offers 2-3 **Strategic Pivots** (Hypotheses) to fix the fatal flaw.

### How to Escape a Gap Report
You cannot "talk your way out" of a Gap Report. You must **Pivot**.
*   Accept one of the AI-generated Hypotheses.
*   Or manually rewrite the specific section of your manifest to address the structural weakness.

---

## 4. The Jury Rubric
The Jury uses a strict rubric to adjudicate points. It favors the Skeptic by default to ensure rigor.

1.  **Vague Ban**: Using words like "proprietary," "advanced," or "robust" without explaining the *physical mechanism* is an automatic loss.
2.  **Asset Check**: Claiming assets (partnerships, data, funding) that were not explicitly stated in the user's input is an automatic loss (Hallucination Check).
3.  **Severity Scaling**:
    *   **High Severity Defense**: Requires **Quantitative Evidence** or a **Direct Comparable**.
    *   **Medium Severity Defense**: Requires a **Specific Mechanism** (qualitative description allowed).
