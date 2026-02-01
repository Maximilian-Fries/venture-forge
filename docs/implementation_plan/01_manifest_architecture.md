# Venture Manifest: The Single Source of Truth

The Venture Manifest is the backbone of MonopolyMap. It is a highly structured JSON object that encapsulates the "Secret" and "Wedge" of a startup. All agents read from and contribute to this manifest.

## JSON Schema Definition

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "VentureManifest",
  "type": "object",
  "required": ["core_thesis", "wedge", "engineering_moat", "timing_risks"],
  "properties": {
    "core_thesis": {
      "type": "object",
      "properties": {
        "statement": { "type": "string", "description": "The 'Secret': What contrarian truth do you believe?" },
        "0_to_1_logic": { "type": "string", "description": "Why is this a new category, not an incremental improvement?" }
      }
    },
    "wedge": {
      "type": "object",
      "properties": {
        "target_audience": { "type": "string", "description": "Specific niche to dominate first." },
        "expansion_path": { "type": "string", "description": "How to move from niche to monopoly." }
      }
    },
    "engineering_moat": {
      "type": "string",
      "description": "Technical advantages that compound over time."
    },
    "timing_risks": {
      "type": "object",
      "properties": {
        "why_now": { "type": "string" },
        "incumbent_blind_spots": { "type": "array", "items": { "type": "string" } }
      }
    },
    "jury_verdict": {
      "type": "object",
      "properties": {
        "monopoly_score": { "type": "number", "minimum": 0, "maximum": 100 },
        "synthesis": { "type": "string" },
        "red_flags": { "type": "array", "items": { "type": "string" } }
      }
    }
  }
}
```

## Core Concepts

### 1. The Secret
Every great business is built around a secret that's hidden from the outside. If a founder can't articulate their "Secret", the Visionary agent will default to a low Monopoly Score.

### 2. The Wedge
You must start with a small, specific market and dominate it before expanding. The Manifest tracks this narrow focus to prevent "Boiling the Ocean" syndrome.
