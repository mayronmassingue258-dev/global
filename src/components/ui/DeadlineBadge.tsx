import { deadlineInfo, type DeadlineTone } from "@/lib/utils/deadline";
import { Badge, type BadgeTone } from "./Badge";

const toneMap: Record<DeadlineTone, BadgeTone> = { closed: "outline", urgent: "danger", soon: "warning", normal: "neutral", unknown: "outline" };

/** Situação do prazo em texto (não só cor). Os prazos "normais" não ganham selo para não poluir listas. */
export function DeadlineBadge({ deadline, showNormal = false }: { deadline: string; showNormal?: boolean }) {
  const info = deadlineInfo(deadline);
  if (info.tone === "normal" && !showNormal) return null;
  return <Badge tone={toneMap[info.tone]}>{info.label}</Badge>;
}
