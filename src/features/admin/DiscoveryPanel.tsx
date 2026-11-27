"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/Field";
import { ErrorState, Notice } from "@/components/feedback/States";
import { useT } from "@/i18n/I18nProvider";
import { ApiError } from "@/lib/api/client";
import type { AdminService } from "@/lib/api/admin";
import { adminService } from "@/lib/services";
import { formatDateTime } from "@/lib/utils/date";
import type { DiscoveryRun, DiscoveryState } from "@/types";
import styles from "./AdminPanel.module.css";

/**
 * Busca automática de bolsas: o admin dispara (ensaio ou publicação) e acompanha. A busca roda na API, em segundo
 * plano; esta tela consulta o andamento a cada poucos segundos enquanto houver uma execução rodando.
 */
export function DiscoveryPanel({ service = adminService, pollMs = 4000, onFinished }: { service?: AdminService; pollMs?: number; onFinished?: () => void }) {
  const t = useT();
  const d = t.discovery;
  const [state, setState] = useState<DiscoveryState | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [choice, setChoice] = useState("week");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<DiscoveryRun | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setState(await service.discovery(signal));
      setLoadFailed(false);
    } catch {
      if (!signal?.aborted) setLoadFailed(true);
    }
  }, [service]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const running = state?.items.find((r) => r.status === "running");
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(async () => {
      const run = await service.discoveryRun(running.id).catch(() => null);
      if (run && run.status !== "running") {
        await load();
        setOpen(run);
        onFinished?.();
      } else if (run && open?.id === run.id) setOpen(run);
    }, pollMs);
    return () => clearInterval(timer);
  }, [running, service, pollMs, load, onFinished, open?.id]);

  async function start(dryRun: boolean) {
    setBusy(true);
    setError(null);
    try {
      const sources = choice === "week" || choice === "all" ? choice : [choice];
      await service.startDiscovery({ dryRun, sources });
      await load();
    } catch (e) {
      setError(e instanceof ApiError && e.code === "discovery_running" ? d.alreadyRunning : d.failed);
    } finally {
      setBusy(false);
    }
  }

  async function toggleLog(run: DiscoveryRun) {
    if (open?.id === run.id) return setOpen(null);
    setOpen(await service.discoveryRun(run.id).catch(() => run));
  }

  if (loadFailed) return <ErrorState title={t.admin.loadFailed} onRetry={() => void load()} />;
  if (!state) return null;

  return (
    <section className={styles.panelBox} aria-labelledby="discovery-title">
      <h2 id="discovery-title" className="t-section">{d.title}</h2>
      <p className="t-secondary t-measure">{d.text}</p>
      {!state.configured ? (
        <Notice>{d.notConfigured(state.provider === "claude" ? "ANTHROPIC_API_KEY" : "GEMINI_API_KEY")}</Notice>
      ) : (
        <div className={styles.discoveryForm}>
          <SelectField label={d.sources} value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="week">{d.week(state.weekSources.length)}</option>
            <option value="all">{d.all(state.sources.length)}</option>
            {state.sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectField>
          <div className={styles.actions}>
            <Button variant="secondary" size="sm" loading={busy} disabled={Boolean(running)} onClick={() => void start(true)}>{d.dryRun}</Button>
            <Button size="sm" disabled={busy || Boolean(running)} onClick={() => void start(false)}>{d.run}</Button>
          </div>
        </div>
      )}
      {running && <p role="status" className="t-meta">{d.running}</p>}
      {error && <Notice role="alert">{error}</Notice>}

      <h3 className={styles.subTitle}>{d.history}</h3>
      {state.items.length === 0 ? <p className="t-meta">{d.none}</p> : (
        <ul className={styles.runs}>
          {state.items.map((run) => (
            <li key={run.id}>
              <div className={styles.runHead}>
                <Badge tone={run.status === "done" ? "success" : run.status === "failed" ? "danger" : "warning"}>{d.status[run.status] ?? run.status}</Badge>
                <span>{formatDateTime(run.startedAt, t.meta.dateLocale)} · {d.kind(run.dryRun)} · {d.sourcesCount(run.sources.length)}</span>
                {run.summary && <span className="t-meta">{d.result(run.summary.created ?? 0, run.summary.updated ?? 0, run.summary.skipped ?? 0)}</span>}
                <Button variant="tertiary" size="sm" aria-expanded={open?.id === run.id} onClick={() => void toggleLog(run)}>{open?.id === run.id ? d.hideLog : d.showLog}</Button>
              </div>
              {open?.id === run.id && <pre className={styles.log}>{open.log || "…"}</pre>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
