# Plan for Consistency & Robustness (Adversarial Engine v2.1)

**Problem**: The current debate flow allows "Bundled Attacks" and "Hand-Wave Defenses", leading to inconsistent Jury verdicts (Variance).
**Goal**: Enforce strict logic to ensure truthful, reproducible outcomes.

---

## 1. The "Atomic Claim" Protocol (Fixing the Skeptic)
**Observation**: In your example, the Skeptic bundled 4 risks/claims into one paragraph:
1. Capital Intensity
2. Sorbent Lifespan
3. Energy Efficiency
4. Reliability (Sand/Heat)

**Fix**: The Visionary can "cherry-pick" the easiest one to defend (Energy Efficiency) and ignore the hard ones (Sand Reliability).
**Implementation**:
-   **Constraint**: The Skeptic must output **Atomic Claims**. One variable per point.
-   **Prompt Update**:
    > "FAILURE MODE: Do not bundle risks. 'High latency and security' is TWO points. Output them separately.
    > Each Point must attack exactly ONE variable (e.g., 'Sorbent Lifespan in >40C heat')."

## 2. The "Mechanism Requirement" (Fixing the Visionary)
**Observation**: The Visionary used "Consultant Speak": *"proprietary sorbent... specifically engineered... unique thermal output."*
**Fix**: Adjectives are not arguments. Mechanisms are arguments.
**Implementation**:
-   **Negative Constraint**:
    > "You are FORBIDDEN from using the words: 'proprietary', 'advanced', 'robust', 'specialized', 'optimized' UNLESS you describe the **Physical Mechanism** immediately after.
    > - Bad: 'We have a robust casing.'
    > - Good: 'We use IP67-rated sealed aluminum casing with positive pressure to prevent dust ingress.'"

## 3. The "Rubric of Death" (Fixing the Jury)
**Observation**: The Jury oscillates because it lacks a standard of evidence.
**Fix**: Give the Jury a checklist. If the Visionary misses any item, they lose.
**Implementation**:
-   **Prompt Update**:
    > "VERDICT RULES:
    > 1. **Vague Ban**: Did the Visionary use 'proprietary' or 'robust' without explaining HOW? -> AUTOMATIC FAIL (Winner: Skeptic).
    > 2. **Hope Ban**: Did they say 'we will focus on R&D'? -> AUTOMATIC FAIL.
    > 3. **The Physics Check**: Did they address the *hardest* part of the Skeptic's claim (e.g., Sand) or just the easiest (Energy)? If they missed the hard part -> AUTOMATIC FAIL."

## 4. Conciseness & Structure (Fixing the Slop)
**Observation**: Agents are writing walls of text. User claims UI truncates them.
**Fix**: Enforce Brevity and Lists.
**Implementation**:
-   **Claim**: Limit to **25 words**. Must be a single punchy sentence.
-   **Reasoning**: Must use **Bullet Points**.
    -   *Bad*: "The problem is that X leads to Y which causes Z..."
    -   *Good*:
        *   "X leads to Y."
        *   "Y causes Z."
        *   "Therefore, the model fails."

## 5. Source Authenticity (Fixing the Hallucinations)
**Observation**: Agents are citing "The Mom Test" loosely or making up sources.
**Fix**: Distinguish between **Evidence** types.
**Implementation**:
-   **Prompt Constraint**:
    > "SOURCE RULES:
    > 1. **Do NOT** cite 'The Mom Test' unless you are quoting a specific user interview transcript provided in context.
    > 2. **Do NOT** invent URL citations.
    > 3. If you rely on Logic, state 'Source: First Principles Logic'.
    > 4. If you rely on Market Norms, state 'Source: Industry Standard (e.g., typical SaaS churn is 5%)'.
    >
    > JURY INSTRUCTION: If a source looks fake or is not found in the context -> AUTOMATIC FAIL."

## 6. UI Visibility (The War Room)
The user needs to see this rigor.
-   **Display**: In the `DebateTable`, show the **Atomic Breakdown**.
    -   Fix CSS to allow text wrapping (remove `truncate` or `line-clamp`).
-   **Reasoning**: Show the Jury's specific "Why I failed you" note.
## 7. The Sufficiency Test (The General Mechanism)
**Observation**: Agents often accept a "Qualitative Mechanism" (e.g., "We have revenue") as a defense against a "Quantitative Risk" (e.g., "Burn rate is $1M/month"). This is a failure of **Magnitude Matching**.
**Fix**: The Jury must enforce a **Sufficiency Test**.
**Implementation**:
-   **Jury Protocol Update**:
    > "VERDICT TEST: **The Sufficiency Check**
    > Does the Defense merely *identify* a counter-force, or does it prove that force is **strong enough**?
    >
    > Examples of FAILURE (Mechanism exists, but fails Sufficiency):
    > - *Attack*: 'You need to acquire 1M users.' -> *Defense*: 'We will use TikTok.' (Fail: TikTok exists, but 1M users is hard).
    > - *Attack*: 'Sales cycle is 3 years.' -> *Defense*: 'We have some revenue.' (Fail: Revenue exists, but is it > 3 years of burn?).
## 8. Truthfulness & Grounding (Fixing the Hallucinations)
**Observation**: The Visionary sometimes invents assets ("We have 1000 GPUs") to win arguments. This is a lie.
**Fix**: Enforce a **Ground Truth Protocol**.
**Implementation**:
-   **Visionary Constraint**:
    > "GROUND TRUTH RULE:
    > You are bound by the User's Proposal.
    > - If the user said 'We have 10 GPUs', you CANNOT say 'We have 1000 GPUs'.
    > - If you need 1000 GPUs to win the argument, you must admit you don't have them and describe a **Credible Acquisition Path** (e.g., 'We will raise $5M Seed to rent H100s').
    > - Inventing assets = AUTOMATIC FAIL."
-   **Jury Instruction**:
    > "Did the Visionary claim an asset (money, patents, partnerships) that is NOT in the User's text?
    > - If YES, did they explain *how* to get it?
    > - If NO explanation -> AUTOMATIC FAIL (Hallucination)."
