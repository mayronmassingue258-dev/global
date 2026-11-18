"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DeadlineBadge } from "@/components/ui/DeadlineBadge";
import { EmptyState, ErrorState, Notice } from "@/components/feedback/States";
import { ListSkeleton } from "@/components/feedback/Skeleton";
import { FitScore } from "@/features/matching/FitScore";
import { ReasonList } from "@/features/matching/ReasonList";
import { SaveButton } from "@/features/scholarships/SaveButton";
import { useT } from "@/i18n/I18nProvider";
import { IS_MOCK_MODE } from "@/lib/config";
import type { ProfileService } from "@/lib/api/profile";
import type { RecommendationService } from "@/lib/api/recommendations";
import { countryName } from "@/lib/matching";
import { profileService, recommendationService } from "@/lib/services";
import { formatDate } from "@/lib/utils/date";
import type { Recommendation, Recommendations } from "@/types";
import styles from "./RecommendationList.module.css";

type Props = {
  limit?: number;
  /** Versão curta do painel: sem resumo nem aviso; 2 motivos por bolsa. */
  compact?: boolean;
  services?: { recommendations: RecommendationService; profile: ProfileService };
};

/** Fora do componente: um objeto novo a cada renderização faria o efeito buscar de novo sem parar. */
const DEFAULT_SERVICES = { recommendations: recommendationService, profile: profileService };

/** "Para você": as bolsas mais compatíveis com o perfil, com nota e os porquês (calculados pelo servidor). */
export function RecommendationList({ limit = 10, compact = false, services = DEFAULT_SERVICES }: Props) {
  const t = useT();
  const [data, setData] = useState<Recommendations | null>(null);
  const [completeness, setCompleteness] = useState<number | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    Promise.all([
      services.recommendations.list(limit, controller.signal),
      services.profile.get(controller.signal).then((p) => p.completeness.percent).catch(() => null)
    ])
      .then(([recs, pct]) => {
        setData(recs);
        setCompleteness(pct);
        setState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, [services, limit, reloadKey]);

  if (state === "loading") return <ListSkeleton rows={compact ? 3 : 4} label={t.recommendations.loading} variant="card" />;
  if (state === "error" || !data) return <ErrorState title={t.recommendations.loadFailed} onRetry={() => setReloadKey((k) => k + 1)} />;

  const profileBanner = completeness !== null && completeness < 100 && (
    <div className={styles.banner}>
      <p>{t.recommendations.completeProfile(completeness)}</p>
      <ButtonLink href="/profile" variant="secondary" size="sm">{t.recommendations.completeProfileCta}</ButtonLink>
    </div>
  );

  if (data.items.length === 0) {
    return (
      <div className={styles.wrap}>
        {profileBanner}
        <EmptyState
          icon={Sparkles}
          title={t.recommendations.empty}
          description={t.recommendations.emptyText}
          action={<ButtonLink href="/scholarships" variant="secondary" size="sm">{t.recommendations.exploreAll}</ButtonLink>}
        />
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {IS_MOCK_MODE && !compact && <Notice>{t.recommendations.demoNotice}</Notice>}
      {(!compact || (completeness !== null && completeness < 50)) && profileBanner}
      {!compact && <p className="t-secondary">{t.recommendations.summary(data.items.length, data.considered, data.excluded)}</p>}
      <ol className={styles.list}>
        {data.items.map((item, index) => <RecommendationCard key={item.scholarship.id} item={item} rank={index + 1} compact={compact} />)}
      </ol>
      {!compact && <p className="t-meta">{t.recommendations.disclaimer}</p>}
    </div>
  );
}

function RecommendationCard({ item, rank, compact }: { item: Recommendation; rank: number; compact: boolean }) {
  const t = useT();
  const s = item.scholarship;
  const locale = t.meta.htmlLang;
  const where = s.match?.destinations.length ? s.match.destinations.map((c) => countryName(c, locale)).join(", ") : s.country;
  const level = s.match?.levels.map((l) => t.vocab.targetLevel[l] ?? l).join(", ") ?? (t.levels[s.level] ?? s.level);
  const titleId = `rec-${s.id}`;
  // Na página, os cartões ficam logo abaixo do h1; no painel, abaixo do h2 da seção.
  const Heading = compact ? "h3" : "h2";
  return (
    <li className={styles.card} aria-labelledby={titleId}>
      <div className={styles.head}>
        <span className={styles.rank} aria-hidden="true">{rank}</span>
        <div className={styles.titleBlock}>
          <p className="t-label">{where} · {level}</p>
          <Heading id={titleId} className={styles.title}><Link href={`/scholarships/${s.id}`}>{s.title}</Link></Heading>
          <p className="t-secondary">{s.institution}</p>
        </div>
        <div className={styles.score}><FitScore score={item.score} fit={item.fit} /></div>
      </div>
      <div className={styles.meta}>
        <Badge tone={item.eligibility === "eligible" ? "success" : "warning"}>{item.eligibility === "eligible" ? t.recommendations.eligible : t.recommendations.possible}</Badge>
        <span className="t-meta">{t.deadline.prefix} {formatDate(s.deadline, t.meta.dateLocale, t.common.dateInvalid)}</span>
        <DeadlineBadge deadline={s.deadline} />
        {s.verification.status !== "verified" && <Badge tone="outline">{t.scholarships.unverified}</Badge>}
      </div>
      <div className={styles.why}>
        <p className="visually-hidden">{t.recommendations.whyTitle}</p>
        <ReasonList reasons={item.reasons} limit={compact ? 2 : 4} />
      </div>
      <div className={styles.actions}>
        <ButtonLink href={`/scholarships/${s.id}`} variant="secondary" size="sm">{t.recommendations.seeScholarship}<span className="visually-hidden">: {s.title}</span></ButtonLink>
        <SaveButton scholarship={s} />
        {s.sourceUrl && !compact && (
          <a className="t-secondary" href={s.sourceUrl} target="_blank" rel="noopener noreferrer">
            {t.recommendations.officialSite}<span className="visually-hidden"> {t.common.newTab}</span>
          </a>
        )}
      </div>
    </li>
  );
}
