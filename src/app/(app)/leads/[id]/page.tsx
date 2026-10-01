import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import type { Lead } from "@/lib/types";
import { LeadDetail } from "./lead-detail";

export default async function LeadPage({ params }: PageProps<"/leads/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const { supabase, user } = await requireUser();
  const [{ data }, settings] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).maybeSingle(),
    getSettings(supabase, user.id),
  ]);
  if (!data) notFound();

  return (
    <div className="space-y-5">
      <Link href="/leads" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Leads
      </Link>
      <LeadDetail
        initialLead={data as Lead}
        aiEnabled={Boolean(settings.anthropic_key)}
        webhookEnabled={Boolean(settings.webhook_url)}
      />
    </div>
  );
}
