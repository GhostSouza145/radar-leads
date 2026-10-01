/** Só dígitos, sem o DDI 55 e sem zero de operadora. */
export function normalizeBrPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
  digits = digits.replace(/^0+/, "");
  if (digits.length < 10 || digits.length > 11) return null;
  // Cadastros antigos (comum na Receita) guardam celular sem o nono dígito:
  // fixo começa com 2 a 5; 6 a 9 é celular.
  if (digits.length === 10 && /[6-9]/.test(digits[2])) {
    digits = `${digits.slice(0, 2)}9${digits.slice(2)}`;
  }
  return digits;
}

/** Celular brasileiro: DDD + 9 + 8 dígitos. */
export function isMobile(digits: string | null): boolean {
  return !!digits && digits.length === 11 && digits[2] === "9";
}

export function formatBrPhone(raw: string | null | undefined): string {
  const d = normalizeBrPhone(raw);
  if (!d) return raw ?? "";
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}

export function whatsappLink(raw: string | null | undefined, text?: string | null): string | null {
  const d = normalizeBrPhone(raw);
  if (!d) return null;
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/55${d}${query}`;
}
