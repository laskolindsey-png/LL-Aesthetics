import { getCurrentTenantId } from "@/lib/tenant";
import { loadRuleOptions } from "@/lib/ruleOptions";
import { createRule } from "@/lib/actions";
import { RuleForm } from "@/components/RuleForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function NewRulePage() {
  const tenantId = await getCurrentTenantId();
  const options = await loadRuleOptions(tenantId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/rules" className="text-xs text-muted hover:text-ink">
          ← Back to Service Rules
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-ink">Add a Rule</h1>
        <p className="mt-1 text-sm text-muted">
          Define one follow-up step. It fires automatically whenever its event is
          recorded for that service.
        </p>
      </div>
      <RuleForm action={createRule} options={options} submitLabel="Add Rule" />
    </div>
  );
}
