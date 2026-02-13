# Technical Roadmap: Threaded Chat Workspaces

Refactoring the current static UI into a dynamic agent-driven debate platform with an initial Pitch Refinement Module.

## Phase 0: Pitch Refinement Module (New!)
- **Goal**: Lock the "Venture Description" before starting the lens analysis.
- **Agent**: The "Venture Associate" (a helpful, neutral guide).
- **Workflow**:
    1. User inputs raw idea.
    2. Agent refines it into a clear, one-paragraph abstract.
    3. User and Agent iterate via chat until user approves (clicks "Lock Description").
    4. Transition to Lens Wizard.

## Phase 1: State Management & Schema (Week 1)
- **Manifest Persistence**: Implement a backend store (or robust local state) for the `VentureManifest`.
- **Validation Layer**: Add Zod-based validation for manifest updates.
- **Refinement State**: Add `pitch_history` and `locked_description` to the schema.

## Phase 2: Collaborative Lens Workspaces (Week 2)
- **Threaded UI**: Replace "Idea Card" with a multi-pane chat interface.
    - Left Pane: The Venture Manifest (Editable).
    - Middle Pane: The Agent Debate Thread.
    - Right Pane: The GP Jury Verdict & Real-time Monopoly Score.
- **Collaborative Flow**:
    - **Proposal**: Visionary/Skeptic propose an angle for the lens.
    - **Discussion**: User can reply, argue, or ask for clarification.
    - **Agreement**: User must "Accept" a position to complete the lens and update the Manifest.

## Phase 3: Adversarial Logic Implementation (Week 3)
- **GP Jury Prompts**: Develop the "Harmonizer" logic.
- **Score Calculation Logic**: Refactor `calculateMonopolyScore` to incorporate "Debate Quality".

## Phase 4: Polish & "Mom Test" Integration (Week 4)
- **Investigator Integration**: "Verify with Investigator" triggers Mom Test questions.
- **Vibrant UI Updates**: Glassmorphic animations, status indicators "Skeptic is typing...".
