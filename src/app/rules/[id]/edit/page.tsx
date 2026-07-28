import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { loadRuleOptions } from "@/lib/ruleOptions";
import { updateRule } from "@/lib/actions";
import { RuleForm } from "@/components/RuleForm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EditRulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenantId = await getCurrentTenantId();
  const [rule, options] = await Promise.all([
    prisma.serviceRule.findFirst({ where: { id, tenantId } }),
    loadRuleOptions(tenantId),
  ]);
  if (!rule) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/rules" className="text-xs text-muted hover:text-ink">
          ← Back to Service Rules
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-ink">Edit Rule</h1>
        <p className="mt-1 text-sm text-muted">
          {rule.service} · {rule.workflowStep}
        </p>
      </div>
      <RuleForm action={updateRule} options={options} defaults={rule} submitLabel="Save Changes" />
    </div>
  );
}
