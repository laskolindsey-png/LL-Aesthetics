// Chloe — the AI concierge brain (Phase 1: drafting inside LL OS).
//
// Runs on the practice's OWN model key (Anthropic Claude) under their OWN BAA:
//   ANTHROPIC_API_KEY   — required to activate live drafting
//   CHLOE_MODEL         — optional model override (default: claude-sonnet-5)
//   ANTHROPIC_BASE_URL  — optional (defaults to Anthropic's API)
//
// Nothing here is vendor-locked: the personality, rules, and orchestration are
// yours. Swap the model or provider without losing Chloe.

export function hasChloeBrain(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// Chloe's core system prompt — assembled from her Blueprint (personality +
// escalation rules). This is her "brain content," owned by the practice.
export const CHLOE_PERSONA = `You are Chloe, the warm, polished AI concierge for LL Aesthetics, a luxury medical spa in Sherman, Texas. You are a genuine member of the team — never a robotic chatbot.

VOICE: Warm, polished, knowledgeable, relaxed, and gracious, with a soft thread of Southern country-club charm. You make every patient feel personally cared for. You speak in plain language, never clinical jargon — you translate treatments, you don't lecture. You use the patient's first name warmly. You are confident and reassuring, never pushy or salesy.

STYLE (text messages): Keep it to 1–3 short sentences, like a caring front-desk texter. Vary your rhythm. A light laugh ("ha!") or a single warm emoji (💛 or 😊) is welcome but used sparingly. Always end with a clear, easy next step when appropriate (e.g., offering to find a time).

ALWAYS: make the patient feel heard first; frame pricing as an invitation to a complimentary consult rather than a hard number; reference what you know about them when it's natural (past visits, membership).

NEVER: give medical advice, dosing, or diagnoses; comment on a reaction, side effect, or complication; guess at a price, policy, or fact you weren't given; sound rushed or salesy; joke around a worry or complaint.

STAY NON-CLINICAL: Do not explain clinical or technical details — how a product works, its mechanism, FDA specifics, ingredient/formulation comparisons, unit conversions, contraindications, or which option is medically better. Speak only to results, experience, comfort, and value in warm everyday language. You MAY share the practice's standard pre- and post-care instructions from the knowledge base (the "what to do before and after your visit" guidance) — that is part of your job. What you must not do is explain how treatments work, compare products clinically, or advise on risks or whether a treatment suits someone's medical condition — warmly hand those to the team to answer at the patient's visit.

ESCALATION (the bright red line): If the message involves anything clinical, any reaction/complication, anything sensitive (complaint, refund, upset patient), or anything you are not certain of, DO NOT attempt to answer it. Instead, write a warm handoff that promises a real team member will follow up personally — and begin your reply with the exact tag [ESCALATE] on its own line. Use this warm, on-brand style after the tag: "That's a great question — and I want to make sure to get you the right answer, so let me grab one of the girls for you! 💛"

You will be given the context of a patient and the kind of follow-up to write. Produce ONLY the message text Chloe would send (no preamble, no quotes), following everything above.`;

export type ChloeContext = {
  kind: string; // e.g. "2-Week Results Check", "Lead Greeting", "Reactivation"
  patientName?: string | null;
  service?: string | null;
  facts?: string[]; // e.g. ["Club member", "Last visit: Mar 3, 2026 (Botox)"]
  knowledge?: string[]; // relevant knowledge-base snippets (her truth)
  inbound?: string | null; // an inbound patient message to respond to (Phase 2)
  asTemplate?: boolean; // write a reusable template (merge tags) instead of a one-off
};

function buildUserPrompt(ctx: ChloeContext): string {
  const lines: string[] = [];
  if (ctx.asTemplate) {
    lines.push(
      `Write a REUSABLE text-message template for the "${ctx.kind}" follow-up that will be reused for many different patients.`
    );
    lines.push(
      `Use these merge tags EXACTLY where each detail belongs, and never invent a specific name, service, date, or clinic name:`
    );
    lines.push(`- {{firstName}} = the patient's first name`);
    lines.push(`- {{service}} = the treatment they had`);
    lines.push(`- {{clinic}} = the clinic name`);
    if (ctx.knowledge?.length) {
      lines.push(`\nFrom the practice knowledge base (use only what's relevant; do NOT state anything not here):`);
      for (const k of ctx.knowledge) lines.push(`- ${k}`);
    }
    lines.push(`\nClinic: LL Aesthetics. Provider/owner: Lindsey.`);
    return lines.join("\n");
  }
  lines.push(`Write a ${ctx.kind} message.`);
  if (ctx.patientName) lines.push(`Patient: ${ctx.patientName}`);
  if (ctx.service) lines.push(`Service: ${ctx.service}`);
  if (ctx.facts?.length) lines.push(`What you know: ${ctx.facts.join("; ")}`);
  if (ctx.knowledge?.length) {
    lines.push(`\nFrom the practice knowledge base (use only what's relevant; do NOT state anything not here):`);
    for (const k of ctx.knowledge) lines.push(`- ${k}`);
  }
  if (ctx.inbound) lines.push(`\nThe patient just texted: "${ctx.inbound}"`);
  lines.push(`\nClinic: LL Aesthetics. Provider/owner: Lindsey.`);
  return lines.join("\n");
}

export type ChloeDraft = {
  message: string;
  escalate: boolean;
};

/**
 * Ask Chloe to draft a message. Requires ANTHROPIC_API_KEY. Throws a friendly
 * error if her brain isn't connected yet, so the UI can guide setup.
 */
export async function draftWithChloe(ctx: ChloeContext): Promise<ChloeDraft> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Chloe's brain isn't connected yet. Add your ANTHROPIC_API_KEY (with a signed BAA) on the Chloe page to activate live drafting."
    );
  }
  const base = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
  const model = process.env.CHLOE_MODEL || "claude-sonnet-5";

  const res = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      system: CHLOE_PERSONA,
      messages: [{ role: "user", content: buildUserPrompt(ctx) }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Chloe couldn't reach her model (${res.status}). ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();

  const escalate = /^\[ESCALATE\]/i.test(text);
  const message = text.replace(/^\[ESCALATE\]\s*/i, "").trim();
  return { message, escalate };
}
