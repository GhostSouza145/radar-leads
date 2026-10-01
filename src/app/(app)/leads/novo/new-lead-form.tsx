"use client";

import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";
import { createManualLead, type ActionResult } from "@/app/actions";

const FIELDS = [
  { name: "name", label: "Nome do negócio", required: true, placeholder: "" },
  { name: "category", label: "Segmento", placeholder: "Ex.: Clínica odontológica" },
  { name: "city", label: "Cidade", placeholder: "" },
  { name: "phone", label: "Telefone / WhatsApp", placeholder: "(11) 91234-5678" },
  { name: "email", label: "E-mail", placeholder: "" },
  { name: "website", label: "Site", placeholder: "https://" },
  { name: "instagram", label: "Instagram", placeholder: "@perfil" },
];

export function NewLeadForm() {
  const [state, action, pending] = useActionState<ActionResult, FormData>(createManualLead, { ok: true });

  return (
    <form action={action} className="card space-y-4 p-5">
      {FIELDS.map((f) => (
        <div key={f.name}>
          <label className="label" htmlFor={f.name}>{f.label}</label>
          <input id={f.name} name={f.name} required={f.required} placeholder={f.placeholder} className="input" />
        </div>
      ))}
      {state.error && <p className="text-sm text-hot">{state.error}</p>}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending && <LoaderCircle className="size-4 animate-spin" />}
        Salvar lead
      </button>
    </form>
  );
}
