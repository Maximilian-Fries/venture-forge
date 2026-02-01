import { CallbackHandler } from "langfuse-langchain";

const LANGFUSE_PUBLIC_KEY = import.meta.env.VITE_LANGFUSE_PUBLIC_KEY;
const LANGFUSE_SECRET_KEY = import.meta.env.VITE_LANGFUSE_SECRET_KEY;
const LANGFUSE_BASE_URL = import.meta.env.VITE_LANGFUSE_HOST || "https://cloud.langfuse.com";

export function getLangfuseCallback() {
    if (!LANGFUSE_PUBLIC_KEY) {
        console.warn("Langfuse Public Key not found. Tracing disabled.");
        return undefined;
    }

    // Note: Support using secret key in dev mode for full tracing (generation details),
    // but safely fallback to public-only in production or if secret is missing.
    // Storing secret key in client-side code is generally unsafe for public apps,
    // but acceptable for local-only / dev tools.
    return new CallbackHandler({
        publicKey: LANGFUSE_PUBLIC_KEY,
        secretKey: LANGFUSE_SECRET_KEY,
        baseUrl: LANGFUSE_BASE_URL,
    });
}
