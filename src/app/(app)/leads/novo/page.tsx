import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewLeadForm } from "./new-lead-form";

export default function NewLeadPage() {
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link href="/leads" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Leads
        </Link>
        <h1 className="page-title">Novo lead</h1>
        <p className="page-sub">
          Cadastre um negócio que você já conhece. Com site ou Instagram informados, a análise
          funciona igual à dos leads do radar.
        </p>
      </div>
      <NewLeadForm />
    </div>
  );
}
