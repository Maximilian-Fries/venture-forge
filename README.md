# Venture Forge

> "But one of them caught our eye—the one in the center. He would neither go towards the feeding grounds at the edge of the ice, nor return to the colony. Shortly afterwards, we saw him heading straight towards the mountains, some 70 kilometers away.
>
> Dr. Ainley explained that even if he caught him and brought him back to the colony, he would immediately head right back for the mountains. But why?"

**An Adversarial Venture Architect for Zero-to-One Ideas.**

Venture Forge is a "Venture Jury" designed to move entrepreneurs from "1 to N" (incremental progress) to "0 to 1" (vertical innovation). It acts as a ruthless filter for startup ideas, forcing them to meet high reliability bars through adversarial debate with AI agents.

## Purpose

Most startup ideas fail because they are "nice to have," solutions looking for a problem, or lack a localized monopoly strategy. Venture Forge prevents this by subjecting your idea to a gauntlet of specialized AI agents:

*   **The Visionary**: Optimistic, looking for the 10x potential and "Secret".
*   **The Skeptic**: Ruthless, looking for fatal flaws and physics constraints.
*   **The Jury**: The decider, synthesizing the debate into a final verdict.

The goal is not just feedback, but a rigorous stress-test to ensure your venture is built on a solid foundation.

## Multi-Framework Evaluation

Venture Forge supports multiple evaluation frameworks to stress-test your idea from different angles:

1.  **Thiel / "Zero to One" (Default)**: Focuses on vertical innovation, secrets, and monopoly wedges. Perfect for deep tech or contrarian ideas.
2.  **Y Combinator**: Focuses on "Make something people want," growth, and traction. Ideal for consumer apps and rapid iteration.

## Documentation

*   **[Technical Stack](docs/tech_stack.md)**: Detailed overview of the frameworks and tools used.
*   **[Workflow Overview](docs/workflow_overview.md)**: Understanding the user journey from Ideation to the War Room.
*   **[Mechanics](docs/mechanics.md)**: Deep dive into the scoring system and logic.

## Getting Started

### Prerequisites

*   Node.js & npm (or bun/yarn)
*   A Supabase project
*   Google Gemini API Key
*   Langfuse details (optional, for tracing)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/Maximilian-Fries/venture-forge.git
    cd venture-forge
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment**
    Create a `.env` file in the root directory:
    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    VITE_GEMINI_API_KEY=your_gemini_key
    
    # Optional - For Observability
    VITE_LANGFUSE_PUBLIC_KEY=...
    VITE_LANGFUSE_HOST=...
    ```

4.  **Run Development Server**
    ```bash
    npm run dev
    ```
