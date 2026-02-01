# RFC 002: Point-Based Adversarial Scoring vs. K-Score

**Status**: Proposed
**Problem**: The current K-Score (Grounding/Logic/Entropy) is heuristic-based. It measures *how well* the AI argues, not *if* the idea is actually good. It is "too easy to score" by simply writing confidently.
**Proposal**: Transition to a deterministic "Point-by-Point" debate system.

---

## 1. The Proposed Workflow (Point-Scoring)

### The Flow
1.  **AI Proposal**: System generates the "Steel-manned" thesis for the Lens.
2.  **Skeptic Critique**:
    *   Skeptic extracts $n$ specific **Weaknesses** (Critical Failure Points).
    *   Format: Bullet points with reasoning + demand for evidence.
3.  **Visionary Defense**:
    *   Visionary must address *each* of the $n$ points specifically.
    *   Must provide reasoning/sources.
4.  **Jury Verdict (The Scorer)**:
    *   Jury reviews each Point $i$ pair (Critique vs Defense).
    *   **Decision**: Awards the point to **Skeptic** (Risk validated) or **Visionary** (Risk mitigated).
    *   **Rule**: No draws.

### The Scoring Formula
Let $L$ be the Importance Weight of the current Lens (e.g., Engineering = 100, Timing = 80).
Let $n$ be the number of debate points.
Let $v$ be the number of points won by the Visionary.

$$ \text{Lens Score} = L \times \frac{v}{n} $$

*Note: The user originally proposed calculating based on Skeptic wins. I recommend basing the "Monopoly Score" (Success Likelihood) on Visionary Wins. Skeptic wins would calculate the "Risk Score".*

---

## 2. Critical Evaluation

### Is it better than current K-Score? **YES.**

| Feature | Current (K-Score) | Proposed (Point-Scoring) |
| :--- | :--- | :--- |
| **Metric** | **Style**: Measures confidence, structure, citations. | **Substance**: Measures who won the argument. |
| **Gaming** | **Easy**: Just write confidently and use "therefore". | **Hard**: Must logically defeat a specific counter-argument. |
| **Granularity** | **Low**: One score for the whole text. | **High**: Specific flaws are identified (e.g., "Won on Tech, Lost on Distribution"). |
| **Truthfulness** | **Low**: A convincing hallucination scores high. | **Medium/High**: Adversarial check forces confrontation of flaws. |

### Limitations of Proposal
1.  **Latency & Cost**: Requires serial chains (Skeptic -> Visionary -> Jury). significantly slower than 1-shot K-Score.
2.  **LLM Bias**: The Jury may favor the last speaker (Visionary).
3.  **Hallucinated Sources**: Demanding "sources" from an LLM without web access often produces fake citations.

---

## 3. Recommended Improvements

### A. Weighting the Criticisms (Fatal vs. Friction)
Not all points are equal.
*   *Skeptic Point A*: "Competitors have more features" (Friction).
*   *Skeptic Point B*: "This is illegal under GDPR" (Fatal).
**Improvement**: The Skeptic should assign a **Severity Tier** (High/Medium/Low) to each point. Losing a "High" severity point should punish the score harder (or set it to 0).

### B. The "Evidence" Tooling
To prevent hallucinations when asking for "sources":
*   **Ideal**: Give agents a `search_web` tool.
*   **MVP**: Prompt the Skeptic to focus on **Logic & Physics** (First Principles) rather than just asking for URL citations, unless the user provided a URL in the Forge.

### C. The "Kill Switch" (Pivot Trigger)
If the Visionary loses >50% of points in a critical lens (e.g., Engineering), the Lens shouldn't just get a low score—it should be marked **FAILED**.
*   **Action**: User must edit the `Manifest` (Pivot) to re-open the lens.

---

## 4. Revised Workflow Spec for Implementation

1.  **Skeptic**: Returns JSON `{ points: [{ id: 1, claim: "...", severity: "high" }] }`
2.  **Visionary**: Returns JSON `{ defenses: [{ point_id: 1, rebuttal: "..." }] }`
3.  **Jury**: Returns JSON `{ results: [{ point_id: 1, winner: "visionary", reasoning: "..." }] }`
4.  **Calculation**:
    *   Weighted Score based on severity.
    *   Monopoly Score updated.
