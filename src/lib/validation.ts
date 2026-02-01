import { z } from "zod";

// Core Thesis Schema
const CoreThesisSchema = z.object({
    statement: z.string().optional(),
    zero_to_one_logic: z.string().optional(),
});

// Wedge Schema
const WedgeSchema = z.object({
    target_audience: z.string().optional(),
    expansion_path: z.string().optional(),
});

// Timing Risks Schema
const TimingRisksSchema = z.object({
    why_now: z.string().optional(),
    incumbent_blind_spots: z.array(z.string()).optional(),
});

// Jury Verdict Schema
const JuryVerdictSchema = z.object({
    monopoly_score: z.number().min(0).max(100).optional(),
    synthesis: z.string().optional(),
    red_flags: z.array(z.string()).optional(),
});

// History Schema
const ChatMessageSchema = z.object({
    role: z.enum(["assistant", "user"]),
    content: z.string(),
    id: z.string(),
});

// Venture Manifest Schema
export const VentureManifestSchema = z.object({
    core_thesis: CoreThesisSchema.optional(),
    wedge: WedgeSchema.optional(),
    engineering_moat: z.string().optional(),
    timing_risks: TimingRisksSchema.optional(),
    jury_verdict: JuryVerdictSchema.optional(),
    locked_description: z.string().optional(),
    pitch_history: z.array(ChatMessageSchema).optional(),
});

export type VentureManifestType = z.infer<typeof VentureManifestSchema>;

export function validateManifest(data: unknown) {
    return VentureManifestSchema.safeParse(data);
}
