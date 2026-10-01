import { z } from "zod";

export const MapsParamsSchema = z.object({
  niche: z.string().trim().min(2, "informe o nicho").max(80),
  location: z.string().trim().min(2, "informe a cidade ou região").max(120),
  depth: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  limit: z.number().int().min(1).max(540).default(60),
});

export const CnpjParamsSchema = z.object({
  uf: z.string().regex(/^[A-Z]{2}$/, "UF inválida"),
  municipio: z.string().regex(/^\d{7}$/, "município inválido"),
  municipioNome: z.string().min(1).max(80),
  cnae: z.string().regex(/^\d{7}$/, "CNAE inválido"),
  cnaeDescricao: z.string().min(1).max(200),
  days: z.number().int().min(7).max(730),
});
