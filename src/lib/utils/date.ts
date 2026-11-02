/** Formata uma data AAAA-MM-DD sem depender do fuso horário do servidor ou do navegador. */
export function formatDate(iso: string, locale = "pt-BR"): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  return date.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Data e hora curtas de um carimbo ISO (ex.: linha do tempo), no fuso do navegador. */
export function formatDateTime(iso: string, locale = "pt-BR"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
