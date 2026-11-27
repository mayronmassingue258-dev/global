"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/feedback/States";
import { useT } from "@/i18n/I18nProvider";
import { ApiError } from "@/lib/api/client";
import type { RecommendationService } from "@/lib/api/recommendations";
import type { ProfileSearch as Search_ } from "@/types";
import styles from "./RecommendationList.module.css";

type ErrorKey = "incomplete" | "user" | "daily" | "running" | "unavailable" | "failed";

function errorKey(e: unknown): ErrorKey {
  if (!(e instanceof ApiError)) return "failed";
  if (e.status === 422) return "incomplete";
  if (e.code === "search_limit_user") return "user";
  if (e.code === "search_limit_daily") return "daily";
  if (e.code === "discovery_running") return "running";
  if (e.code === "discovery_not_configured") return "unavailable";
  return "failed";
}

/**
 * "Procurar novas bolsas para mim": o estudante pede uma busca na web guiada pelo perfil, sem depender de um admin.
 * A busca roda no servidor (alguns minutos); esta caixa acompanha e avisa a lista para recarregar quando terminar.
 */
export function ProfileSearch({ service, onFinished, pollMs = 5000 }: { service: RecommendationService; onFinished: () => void; pollMs?: number }) {
  const t = useT();
  const r = t.recommendations;
  const [search, setSearch] = useState<Search_ | null>(null);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    service.latestSearch(controller.signal).then(setSearch).catch(() => {});
    return () => controller.abort();
  }, [service]);

  useEffect(() => {
    if (search?.status !== "running") return;
    const timer = setInterval(async () => {
      const latest = await service.latestSearch().catch(() => null);
      if (latest && latest.status !== "running") {
        setSearch(latest);
        onFinished();
      }
    }, pollMs);
    return () => clearInterval(timer);
  }, [search?.status, service, pollMs, onFinished]);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      setSearch(await service.search());
    } catch (e) {
      setError(errorKey(e));
    } finally {
      setBusy(false);
    }
  }

  const running = search?.status === "running";
  return (
    <section className={styles.search} aria-labelledby="profile-search-title">
      <div>
        <h2 id="profile-search-title" className={styles.searchTitle}>{r.searchTitle}</h2>
        <p className="t-secondary">{r.searchText}</p>
      </div>
      <div className={styles.searchActions}>
        <Button variant="secondary" size="sm" onClick={() => void start()} loading={busy} disabled={running}>
          <Search size={16} aria-hidden="true" /> {r.searchButton}
        </Button>
      </div>
      <div role="status" className="t-secondary">
        {running && r.searchRunning}
        {search?.status === "done" && r.searchDone(search.summary?.created ?? 0, search.summary?.updated ?? 0)}
        {search?.status === "failed" && r.searchFailed}
      </div>
      {error && (
        <Notice role="alert">
          {r.searchErrors[error]} {error === "incomplete" && <Link href="/profile">{r.completeProfileCta}</Link>}
        </Notice>
      )}
    </section>
  );
}
