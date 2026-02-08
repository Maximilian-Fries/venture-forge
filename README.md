# MonopolyMap

"But one of them caught our eye—the one in the center. He would neither go towards the feeding grounds at the edge of the ice, nor return to the colony. Shortly afterwards, we saw him heading straight towards the mountains, some 70 kilometers away.

Dr. Ainley explained that even if he caught him and brought him back to the colony, he would immediately head right back for the mountains. But why?"

**An Adversarial Venture Architect for Zero-to-One Ideas.**

MonopolyMap is supposed to be a ruthless, adversarial **Venture Jury** designed to move entrepreneurs from "1 to N" (incremental progress) to "0 to 1" (vertical innovation). It acts as a filter for startup ideas, forcing them to meet the high reliability bars set by Peter Thiel (*Zero to One*) and Rob Fitzpatrick (*The Mom Test*).

---

## 🧠 Core Philosophy

Most startup ideas fail because they are "nice to have," "feature improvements," or solutions looking for a problem. MonopolyMap prevents this by enforcing:

1.  **The Secret (Zero to One)**: We don't want to build "Uber for X." or Piss-Crystals. We seek monopolies built on proprietary technology, network effects, economies of scale, and branding.
2.  **The Mom Test (Validation)**: We never ask "Would you use this?" We only care about past behavior. We hunt for "Bad Data" (compliments, fluff, hypotheticals) and eliminate it.
3.  **The Wedge**: Start with a small, specific market and dominate it completely before expanding.

## 👥 The Venture Jury (Multi-Agent System)

Instead of a single AI, your idea faces a panel of specialized agents:

*   **🔭 The Visionary**: Optimistic. Looks for the 10x potential, the "Secret," and the path to global scale. 
*   **🛡️ The Skeptic**: Ruthless. Looks for errors, physics constraints, timing traps, and market apathy.
*   **⚖️ The General Partner (GP) / Jury**: The Decider. Synthesizes the debate into a final "Monopoly Score" and investment memo.

## 🔍 The 7 Strategic Lenses

Every venture is analyzed through five critical lenses. If you fail one, you don't pass Go.

| Lens | The Critical Question | Success Criteria |
| :--- | :--- | :--- |
| **Engineering** | Can you create breakthrough technology, not just incremental improvements? | Proprietary tech vs. Wrapper/Service business. |
| **Timing** | Why now? Is now the right time to start this particular company? | Specific macro catalyst vs. General Trend. |
| **Monopoly** | Can you dominate a market so small that every participant is identifiable? | Focused "Pond" vs. Broad "Ocean". |
| **People** | Do you have the right team with unique founder-market fit? | Credentials/skills vs. Generic passion. |
| **Distribution** | Do you have a way to deliver your product, not just create it? | Viral/Owned distribution vs. Rented/Paid ads. |
| **Durability** | Will your market position be defensible 10-20 years into the future? | Network effects/Scaling vs. First Mover Advantage. |
| **Secrets** | Have you identified a unique opportunity that others don't see? | Contrarian insight vs. Conventional wisdom. |

---

## 🛠️ Technology Stack

MonopolyMap is a modern, high-performance web application built with:

*   **Framework**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
*   **Language**: [TypeScript](https://www.typescriptlang.org/)
*   **UI System**: [Shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/)
*   **State Management**: [Zustand](https://github.com/pmndrs/zustand) + [TanStack Query](https://tanstack.com/query/latest)
*   **Backend/Database**: [Supabase](https://supabase.com/)
*   **AI Orchestration**: [LangChain](https://js.langchain.com/docs/) + [Gemini 1.5 Pro](https://deepmind.google/technologies/gemini/)
*   **Observability**: [Langfuse](https://langfuse.com/) (Prompt Management & Tracing)

## 🚀 Getting Started

### Prerequisites

*   Node.js & npm (or bun/yarn)
*   A Supabase project (for database)
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
    # Optional
    VITE_LANGFUSE_PUBLIC_KEY=...
    VITE_LANGFUSE_HOST=...
    ```

4.  **Run Development Server**
    ```bash
    npm run dev
    ```
