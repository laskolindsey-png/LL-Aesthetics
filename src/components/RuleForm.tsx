import Link from "next/link";

type Options = {
  patientEvents: string[];
  services: string[];
  workflowSteps: string[];
  categories: string[];
  anchors: string[];
  assignees: string[];
  priorities: string[];
};

type Defaults = {
  id?: string;
  patientEvent?: string;
  service?: string;
  serviceCategory?: string | null;
  step?: number;
  workflowStep?: string;
  delayDays?: number;
  anchor?: string;
  assignedTo?: string;
  priority?: string;
  automationTemplate?: string | null;
};

// Renders <option>s, injecting the current value if it isn't in the list.
function opts(list: string[], current?: string | null) {
  const set = new Set(list);
  if (current && !set.has(current)) list = [current, ...list];
  return list.map((v) => (
    <option key={v} value={v}>
      {v}
    </option>
  ));
}

export function RuleForm({
  action,
  options,
  defaults = {},
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  options: Options;
  defaults?: Defaults;
  submitLabel: string;
}) {
  return (
    <form action={action} className="card space-y-5 p-6">
      {defaults.id && <input type="hidden" name="ruleId" value={defaults.id} />}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">When this happens (Patient Event)</label>
          <select name="patientEvent" className="input" defaultValue={defaults.patientEvent ?? "Treatment Completed"}>
            {opts(options.patientEvents, defaults.patientEvent)}
          </select>
        </div>
        <div>
          <label className="label">For this Service</label>
          <select name="service" className="input" defaultValue={defaults.service ?? ""}>
            {opts(options.services, defaults.service)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Do this Follow-Up</label>
        <input
          name="workflowStep"
          className="input"
          list="workflow-steps"
          placeholder="e.g. 2-Week Results Check"
          defaultValue={defaults.workflowStep ?? ""}
        />
        <datalist id="workflow-steps">
          {options.workflowSteps.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <p className="mt-1 text-xs text-muted">Pick from the list or type a new one.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="label">Step # (order)</label>
          <input type="number" name="step" min={1} className="input" defaultValue={defaults.step ?? 1} />
        </div>
        <div>
          <label className="label">Days after event</label>
          <input type="number" name="delayDays" min={0} className="input" defaultValue={defaults.delayDays ?? 0} />
        </div>
        <div>
          <label className="label">Priority</label>
          <select name="priority" className="input" defaultValue={defaults.priority ?? "Medium"}>
            {opts(options.priorities, defaults.priority)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="label">Assigned to</label>
          <select name="assignedTo" className="input" defaultValue={defaults.assignedTo ?? "Front Desk"}>
            {opts(options.assignees, defaults.assignedTo)}
          </select>
        </div>
        <div>
          <label className="label">Service Category</label>
          <select name="serviceCategory" className="input" defaultValue={defaults.serviceCategory ?? ""}>
            <option value="">—</option>
            {opts(options.categories, defaults.serviceCategory)}
          </select>
        </div>
        <div>
          <label className="label">Counts from (Anchor)</label>
          <select name="anchor" className="input" defaultValue={defaults.anchor ?? "Treatment Date"}>
            {opts(options.anchors, defaults.anchor)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Message Template name (optional)</label>
        <input
          name="automationTemplate"
          className="input"
          placeholder="Defaults to the follow-up name"
          defaultValue={defaults.automationTemplate ?? ""}
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        <Link href="/rules" className="btn-ghost">
          Cancel
        </Link>
        <button className="btn-primary">{submitLabel}</button>
      </div>
    </form>
  );
}
