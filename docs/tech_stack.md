# Technology Stack & Frameworks

Venture Forge is built on a modern, type-safe, and performance-oriented stack designed for interactive AI applications.

## Core Framework
- **[React](https://react.dev/)**: The library for web and native user interfaces.
- **[Vite](https://vitejs.dev/)**: Next Generation Frontend Tooling, used for fast development and building.
- **[TypeScript](https://www.typescriptlang.org/)**: Strongly typed programming language that builds on JavaScript, giving you better tooling at any scale.

## UI & Styling
- **[Tailwind CSS](https://tailwindcss.com/)**: A utility-first CSS framework for rapidly building modern websites without ever leaving your HTML.
- **[Shadcn/ui](https://ui.shadcn.com/)**: Re-usable components built using Radix UI and Tailwind CSS. accessible, and customizable.
- **[Lucide React](https://lucide.dev/icons/)**: Beautiful & consistent icons.

## State Management & Data Fetching
- **[Zustand](https://github.com/pmndrs/zustand)**: A small, fast and scalable bearbones state-management solution using simplified flux principles. Used for global client state (e.g., UI preferences, current session flags).
- **[TanStack Query](https://tanstack.com/query/latest)**: Powerful asynchronous state management for TS/JS, used for server state (fetching, caching, synchronizing and updating server state).

## Backend & Database
- **[Supabase](https://supabase.com/)**: The open source Firebase alternative.
    - **PostgreSQL**: The world's most advanced open source relational database.
    - **Authentication**: Secure user login and session management.
    - **Realtime**: (Optional) Listen to database changes.

## AI & Orchestration
- **[Google Gemini API](https://ai.google.dev/)**: The underlying large language model (LLM) powering the analysis.
- **[LangChain](https://js.langchain.com/)**: Framework for developing applications powered by language models. Used for prompt chaining and agent orchestration.
- **[Langfuse](https://langfuse.com/)**: Open source LLM engineering platform. Used for:
    - **Tracing**: Observability into agent execution steps.
    - **Prompt Management**: Versioning and managing prompts outside the code.
    - **Evaluation**: Monitoring model performance.

## Routing
- **[React Router](https://reactrouter.com/)**: Client-side routing for single-page applications.

## Build & Quality
- **ESLint**: Pluggable JavaScript linter.
- **Prettier**: Opinionated code formatter.
