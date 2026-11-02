"use client";

import { useT } from "@/i18n/I18nProvider";
import { deadlineInfo, type DeadlineTone } from "@/lib/utils/deadline";
import { Badge, type BadgeTone } from "./Badge";

const toneMap: Record<DeadlineTone, BadgeTone> = { closed: "outline", urgent: "danger", soon: "warning", normal: "neutral", unknown: "outline" };

/** Situação do prazo em texto (não só cor). Os prazos "normais" não ganham selo para não poluir listas. */
export function DeadlineBadge({ deadline, showNormal = false }: { deadline: string; showNormal?: boolean }) {
  const t = useT();
  const info = deadlineInfo(deadline, new Date(), t.deadline);
  if (info.tone === "normal" && !showNormal) return null;
  return <Badge tone={toneMap[info.tone]}>{info.label}</Badge>;
}
