// Message templates: merge-field rendering + sensible starter copy.
// Plain module (no "use server") so server components and actions can share it.

export const TEMPLATE_TOKENS: { token: string; desc: string }[] = [
  { token: "{{firstName}}", desc: "Patient's first name" },
  { token: "{{patient}}", desc: "Patient's full name" },
  { token: "{{service}}", desc: "The service / treatment" },
  { token: "{{date}}", desc: "Treatment date" },
  { token: "{{clinic}}", desc: "Your clinic name" },
];

export type TemplateContext = {
  patient?: string | null;
  service?: string | null;
  date?: string | null;
  clinic?: string | null;
};

/** Fill {{tokens}} in a template body from a context. Unknown tokens are left as-is. */
export function renderTemplate(body: string, ctx: TemplateContext): string {
  const full = (ctx.patient ?? "").trim();
  const first = full.split(/\s+/)[0] ?? "";
  const map: Record<string, string> = {
    patient: full,
    firstName: first,
    service: (ctx.service ?? "").trim(),
    date: (ctx.date ?? "").trim(),
    clinic: (ctx.clinic ?? "LL Aesthetics").trim(),
  };
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, key: string) =>
    key in map ? map[key] : whole
  );
}

const CLINIC = "{{clinic}}";

// Starter copy per follow-up. Keyed by template name; anything without a specific
// entry gets a friendly generic default. All editable in the app afterward.
export const DEFAULT_MESSAGES: Record<string, string> = {
  "Post-Care Instructions":
    `Hi {{firstName}}! Thank you for coming in to ${CLINIC} today. Here are your post-care instructions for your {{service}} — please reach out with any questions. We're here for you!`,
  "1-Day Check-In":
    `Hi {{firstName}}, just checking in after your {{service}} yesterday — how are you feeling? Let us know if you have any questions. — ${CLINIC}`,
  "2-Day Check-In":
    `Hi {{firstName}}, checking in on how you're feeling after your {{service}}. Any questions at all, we're happy to help. — ${CLINIC}`,
  "2-Week Results Check":
    `Hi {{firstName}}! It's been about two weeks since your visit — how are you loving your results? If you'd like any little adjustments, we'd be so happy to get you in. 💛 — ${CLINIC}`,
  "2.5-Month Rebooking Reminder":
    `Hi {{firstName}}, it's just about time to refresh those results! Want me to find you a time to come back in? We'd love to see you at ${CLINIC}. 💛`,
  "4-Week Rebooking Reminder":
    `Hi {{firstName}}, you're due to rebook your {{service}} soon — want us to get you on the calendar at ${CLINIC}?`,
  "5-Week Rebooking Reminder":
    `Hi {{firstName}}, ready to keep your results going? Let's rebook your {{service}} at ${CLINIC}.`,
  "6-Month Reactivation":
    `Hi {{firstName}}, we've missed you at ${CLINIC}! It's been a while since your last visit and we'd love to help you get back on track. Can we get you scheduled?`,
  "9-Month Reactivation":
    `Hi {{firstName}}, it's been a while — we'd love to welcome you back to ${CLINIC}. Can we find a time that works for you?`,
  "Welcome Message":
    `Hi {{firstName}}, welcome to ${CLINIC}! We're so glad you're here. Reach out anytime — we're always happy to help.`,
  "Thank You Message":
    `Thank you for visiting ${CLINIC}, {{firstName}}! It was a pleasure taking care of you. We can't wait to see you again.`,
  "Membership Invitation":
    `Hi {{firstName}}, based on your visits you'd be a wonderful fit for our membership — savings on the treatments you already love at ${CLINIC}. Want the details?`,
  "Lead Greeting #1":
    `Hi {{firstName}}! Thanks so much for your interest in ${CLINIC}. What can we help you with? We'd love to get you booked.`,
  "Lead Greeting #2":
    `Hi {{firstName}}, following up from ${CLINIC} — happy to answer any questions or find a time that works for you!`,
  "Refer a Friend Reminder":
    `Hi {{firstName}}! Loving your results? Refer a friend to ${CLINIC} and you'll both enjoy a little something special.`,
  "Peptide 1-Week Check-In":
    `Hi {{firstName}}, checking in a week into your program — how are you feeling? Any questions, we're right here. — ${CLINIC}`,
  "Peptide Refill Reminder":
    `Hi {{firstName}}, you're just about due for a refill. Want us to get your next order started? — ${CLINIC}`,
  "Prescription Sent Notification":
    `Hi {{firstName}}, good news — your prescription is on its way! Let us know if you have any questions. — ${CLINIC}`,
  "1-Month Refill Reminder":
    `Hi {{firstName}}, it's about time for your refill. Would you like us to get that started? — ${CLINIC}`,
};

/** A specific starter message for a template key, or a friendly generic one. */
export function defaultMessageFor(key: string): string {
  if (DEFAULT_MESSAGES[key]) return DEFAULT_MESSAGES[key];
  return `Hi {{firstName}}, a quick note from ${CLINIC} about your {{service}}. Please reach out with any questions!`;
}
