import pt from "@/i18n/dictionaries/pt";

export type DeadlineTone = "closed" | "urgent" | "soon" | "normal" | "unknown";
export type DeadlineInfo = { days: number | null; tone: DeadlineTone; label: string };

const DAY = 24 * 60 * 60 * 1000;

/** Dias inteiros entre hoje (UTC) e a data AAAA-MM-DD. Negativo = já passou. null = data inválida. */
export function daysUntil(iso: string, now: Date = new Date()): number | null {
  const target = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(target)) return null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / DAY);
}

/**
 * Situação do prazo para exibir. Os limites (14 e 45 dias) são de interface, não regras do provedor.
 * O texto evita falsa precisão: o fuso do provedor pode mudar o último dia.
 */
export function deadlineInfo(iso: string, now: Date = new Date(), text: typeof pt.deadline = pt.deadline): DeadlineInfo {
  const days = daysUntil(iso, now);
  if (days === null) return { days, tone: "unknown", label: text.unknown };
  if (days < 0) return { days, tone: "closed", label: text.closed };
  if (days === 0) return { days, tone: "urgent", label: text.today };
  if (days === 1) return { days, tone: "urgent", label: text.tomorrow };
  return { days, tone: days <= 14 ? "urgent" : days <= 45 ? "soon" : "normal", label: text.daysLeft(days) };
}
