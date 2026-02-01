import type { VentureManifest } from "@/types/database";

interface MockVenture {
  id: string;
  user_id: string;
  title: string;
  pitch: string;
  monopoly_score: number;
  manifest: VentureManifest;
  created_at: string;
  updated_at: string;
}

export const MOCK_VENTURES: MockVenture[] = [
  {
    id: "mock-1",
    user_id: "mock-user",
    title: "Orbital Debris Mining",
    pitch: "A swarm of autonomous satellites that capture and recycle space junk into 3D-printable metal filament for in-orbit manufacturing, solving the Kessler Syndrome while enabling off-earth construction.",
    monopoly_score: 85,
    manifest: {
      locked_description: "A swarm of autonomous satellites that capture and recycle space junk into 3D-printable metal filament for in-orbit manufacturing.",
      core_thesis: {
        statement: "The cost of launching mass is the bottleneck of space economy; recycling mass already in orbit is 100x cheaper than launching new material.",
        zero_to_one_logic: "Moving from 'avoiding debris' to 'harvesting debris' turns a liability into a resource asset."
      },
      wedge: {
        target_audience: "Government space agencies (NASA, ESA) needing debris mitigation compliance",
        expansion_path: "Government contracts → Commercial satellite operators → In-orbit manufacturing platforms"
      },
      engineering_moat: "Proprietary AI vision system trained on 50,000+ tracked debris objects. Patent-pending magnetic capture mechanism. 3 years of orbital testing data.",
      timing_risks: {
        why_now: "Kessler Syndrome reaching critical threshold. SpaceX Starlink creating urgency. New space economy needs raw materials.",
        incumbent_blind_spots: ["Traditional aerospace too slow", "No one treating debris as resource"]
      },
      competitors: [
        { name: "Astroscale", weakness: "Only removes debris, doesn't recycle it" },
        { name: "ClearSpace", weakness: "Single-target missions, not scalable" },
        { name: "D-Orbit", weakness: "Focused on deorbiting, not material recovery" }
      ],
      interviews: [
        { id: "int-1", name: "Dr. Sarah Chen", role: "NASA Orbital Debris Program", key_insight: "Agencies would pay premium for recycled materials vs. launch costs", status: "completed" },
        { id: "int-2", name: "Marcus Webb", role: "SpaceX Supply Chain", key_insight: "", status: "planned" }
      ],
      interview_questions: [
        "What's your current cost per kg to get materials to orbit?",
        "How often do you delay missions due to debris collision risk?",
        "Tell me about the last time you had to redesign a satellite for debris protection."
      ],
      jury_verdict: {
        monopoly_score: 85,
        synthesis: "Strong 0-to-1 thesis with clear technical moat. Timing is excellent with regulatory pressure mounting.",
        red_flags: ["Capital intensive", "Regulatory approval timeline uncertain"]
      }
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "mock-2",
    user_id: "mock-user",
    title: "AI Legal DefenseDAO",
    pitch: "A decentralized autonomous organization that pools funds to train a specialized LLM on case law, providing affordable, top-tier legal defense for gig workers against platform algorithm abuse.",
    monopoly_score: 72,
    manifest: {
      locked_description: "A decentralized autonomous organization that pools funds to train a specialized LLM on case law.",
      core_thesis: {
        statement: "Legal justice is currently pay-to-win; AI can commoditize elite legal reasoning.",
        zero_to_one_logic: "Democratizing access to high-end legal defense changes the power dynamic between platforms and workers."
      },
      wedge: {
        target_audience: "Uber/Lyft drivers fighting deactivation decisions",
        expansion_path: "Gig workers → Freelancers → Small businesses → Consumer class actions"
      },
      engineering_moat: "Fine-tuned model on 2M employment law cases. Network effects from pooled case outcomes. Community-contributed precedent database.",
      timing_risks: {
        why_now: "Gig economy lawsuits exploding. LLMs finally capable of legal reasoning. Workers organizing online.",
        incumbent_blind_spots: ["BigLaw ignores small cases", "Legal aid underfunded"]
      },
      competitors: [
        { name: "DoNotPay", weakness: "Consumer disputes only, not employment law" },
        { name: "LegalZoom", weakness: "Document templates, not litigation" }
      ],
      interviews: [
        { id: "int-3", name: "Maria Santos", role: "Rideshare Drivers United", key_insight: "Drivers lose 90% of disputes because they can't afford lawyers", status: "completed" }
      ],
      interview_questions: [
        "Walk me through the last time you tried to fight a deactivation.",
        "How much would you pay monthly for legal protection?",
        "What happened when you tried to get a lawyer?"
      ],
      jury_verdict: {
        monopoly_score: 72,
        synthesis: "Compelling social mission with clear market need. DAO structure adds complexity but aligns incentives.",
        red_flags: ["Regulatory uncertainty around AI legal advice", "DAO governance challenges"]
      }
    },
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  }
];

// Helper to find a mock venture by ID
export function getMockVenture(id: string): MockVenture | undefined {
  return MOCK_VENTURES.find(v => v.id === id);
}
