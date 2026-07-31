// Starter titles for Chloe's knowledge base — the QUESTIONS and topics a medspa
// needs to answer. Content is left blank for the practice to fill with their own
// real answers (we never fabricate pricing or clinical facts).

export const KNOWLEDGE_CATEGORIES = [
  "Service",
  "FAQ",
  "Aftercare",
  "Policy",
  "Pricing",
  "Membership",
  "Promotion",
] as const;
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export const STARTER_FAQS = [
  "How long does Botox last?",
  "Does Botox hurt?",
  "What's the difference between Botox and filler?",
  "How soon will I see results?",
  "Is there any downtime?",
  "How do I prepare for my appointment?",
  "Am I a good candidate?",
  "Do you offer memberships or packages?",
  "What forms of payment do you accept?",
  "How much does treatment cost?",
];

export const STARTER_POLICIES = [
  "Cancellation Policy",
  "Late Arrival Policy",
  "Deposit Policy",
  "Refund Policy",
  "No-Show Fee",
];

export const STARTER_AFTERCARE = [
  "Botox / Tox Aftercare",
  "Dermal Filler Aftercare",
  "Laser / Device Aftercare",
];

// A guiding placeholder shown in the editor for blank entries.
export const CATEGORY_HINT: Record<string, string> = {
  Service: "What it treats, what to expect, downtime, who's a good candidate, price range.",
  FAQ: "Answer in Chloe's warm voice — plain language, a few sentences.",
  Aftercare: "The do's and don'ts you send after this treatment.",
  Policy: "Your exact policy wording so Chloe states it correctly.",
  Pricing: "Ranges or starting prices you're comfortable sharing.",
  Membership: "What's included, the monthly price, and the perks.",
  Promotion: "Current offers, with any dates/conditions.",
};
