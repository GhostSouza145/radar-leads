import { baseUpdatedAt } from "@/lib/sources/cnpj";
import { EmpresasNovasClient } from "./empresas-novas-client";

export default async function EmpresasNovasPage() {
  const updated = await baseUpdatedAt();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Empresas novas</h1>
        <p className="page-sub">
          CNPJs abertos recentemente, direto dos dados públicos da Receita Federal, com telefone,
          e-mail e sócios. Negócio novo ainda está escolhendo fornecedores.
          {updated && <> Base atualizada em <strong className="text-ink">{updated}</strong>.</>}
        </p>
      </div>
      <EmpresasNovasClient />
    </div>
  );
}
