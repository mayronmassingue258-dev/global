"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { EmptyState, ErrorState, Notice } from "@/components/feedback/States";
import { ListSkeleton } from "@/components/feedback/Skeleton";
import { useT } from "@/i18n/I18nProvider";
import { ApiError } from "@/lib/api/client";
import type { AdminQuery, AdminService } from "@/lib/api/admin";
import { adminService } from "@/lib/services";
import { formatDate } from "@/lib/utils/date";
import type { AdminReport, AdminScholarship, Scholarship } from "@/types";
import styles from "./AdminPanel.module.css";

const PAGE_SIZE = 25;

/** Bolsa no formato do importador (o que o PUT aceita), para editar como JSON. */
export function toImportFormat(s: Scholarship) {
  const { id: _id, status: _status, origin: _origin, lastCheckedAt: _checked, ...rest } = s as Scholarship & { openReports?: number; hiddenReason?: string };
  const { openReports: _reports, hiddenReason: _reason, ...clean } = rest as typeof rest & { openReports?: number; hiddenReason?: string };
  return clean;
}

const TEMPLATE = {
  title: "", institution: "", country: "", level: "Mestrado", fundingType: "Integral", funding: "", deadline: "2027-01-31", summary: "",
  requirements: [], requiredDocuments: [], sourceUrl: "https://", verification: { status: "unverified" },
  match: { levels: ["master"], fields: [], eligibleNationalities: [], destinations: [], coverage: ["tuition", "living"], languages: [], tests: [], minGpaPercent: null, requiredCompletedLevel: null, maxAge: null, minWorkYears: null, restrictedTo: [], applicationFee: false, studyMode: "onsite" }
};

export function AdminPanel({ service = adminService }: { service?: AdminService }) {
  const t = useT();
  const a = t.admin;
  const [query, setQuery] = useState<AdminQuery>({ status: "all", verification: "all", reported: false, search: "", page: 1 });
  const [search, setSearch] = useState("");
  const [data, setData] = useState<{ items: AdminScholarship[]; total: number } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    service.list(query, controller.signal)
      .then((d) => { setData(d); setState("ready"); })
      .catch(() => { if (!controller.signal.aborted) setState("error"); });
    return () => controller.abort();
  }, [service, query, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);
  const page = query.page ?? 1;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className={styles.wrap}>
      <form className={styles.filters} aria-label={a.filters} onSubmit={(e) => { e.preventDefault(); setQuery((q) => ({ ...q, search, page: 1 })); }}>
        <SelectField label={a.status} value={query.status} onChange={(e) => setQuery((q) => ({ ...q, status: e.target.value as AdminQuery["status"], page: 1 }))}>
          {(["all", "active", "hidden"] as const).map((s) => <option key={s} value={s}>{a.statusOptions[s]}</option>)}
        </SelectField>
        <SelectField label={a.verification} value={query.verification} onChange={(e) => setQuery((q) => ({ ...q, verification: e.target.value as AdminQuery["verification"], page: 1 }))}>
          {(["all", "verified", "unverified"] as const).map((s) => <option key={s} value={s}>{a.verificationOptions[s]}</option>)}
        </SelectField>
        <label className={styles.check}>
          <input type="checkbox" checked={Boolean(query.reported)} onChange={(e) => setQuery((q) => ({ ...q, reported: e.target.checked, page: 1 }))} />
          {a.reportedOnly}
        </label>
        <TextField label={a.search} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div><Button type="submit" variant="secondary" size="sm">{t.landing.searchSubmit}</Button></div>
      </form>

      <div className={styles.bar}>
        <p className="t-secondary" role="status">{data && state === "ready" ? a.total(data.total) : ""}</p>
        <Button variant="secondary" size="sm" onClick={() => setCreating((c) => !c)} aria-expanded={creating}>{a.newScholarship}</Button>
      </div>
      {creating && <JsonEditor service={service} initialId="" initial={TEMPLATE} onSaved={() => { setCreating(false); reload(); }} />}

      {state === "loading" && <ListSkeleton rows={4} label={t.common.loading} />}
      {state === "error" && <ErrorState title={a.loadFailed} onRetry={reload} />}
      {state === "ready" && data && data.items.length === 0 && <EmptyState title={a.empty} />}
      {state === "ready" && data && data.items.length > 0 && (
        <ul className={styles.list}>
          {data.items.map((item) => <AdminRow key={item.id} item={item} service={service} onChanged={reload} />)}
        </ul>
      )}

      {data && pages > 1 && (
        <nav className={styles.pager} aria-label={a.pagination}>
          <Button variant="tertiary" size="sm" disabled={page <= 1} onClick={() => setQuery((q) => ({ ...q, page: page - 1 }))} aria-label={a.previous}>←</Button>
          <span className="t-meta">{page} / {pages}</span>
          <Button variant="tertiary" size="sm" disabled={page >= pages} onClick={() => setQuery((q) => ({ ...q, page: page + 1 }))} aria-label={a.next}>→</Button>
        </nav>
      )}
    </div>
  );
}

function AdminRow({ item, service, onChanged }: { item: AdminScholarship; service: AdminService; onChanged: () => void }) {
  const t = useT();
  const a = t.admin;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [panel, setPanel] = useState<"none" | "reports" | "edit">("none");
  const [reports, setReports] = useState<AdminReport[] | null>(null);
  const live = item.status !== "hidden";
  const verified = item.verification.status === "verified";

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setFailed(false);
    try {
      await action();
      onChanged();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const openReports = async () => {
    setPanel(panel === "reports" ? "none" : "reports");
    if (panel !== "reports") {
      setReports(null);
      try { setReports(await service.reports(item.id)); } catch { setReports([]); setFailed(true); }
    }
  };

  return (
    <li className={styles.row}>
      <div className={styles.rowHead}>
        <div className={styles.rowTitle}>
          <p className="t-label">{item.id} · {a.origin[item.origin ?? "manual"] ?? item.origin}</p>
          <h2 className={styles.title}>{item.title}</h2>
          <p className="t-secondary">{item.institution} · {t.deadline.prefix} {formatDate(item.deadline, t.meta.dateLocale, t.common.dateInvalid)}</p>
        </div>
        <div className={styles.badges}>
          <Badge tone={live ? "success" : "danger"}>{live ? a.live : `${a.hidden}${item.hiddenReason ? ` · ${a.hiddenReasons[item.hiddenReason] ?? item.hiddenReason}` : ""}`}</Badge>
          <Badge tone={verified ? "success" : "outline"}>{verified ? t.scholarships.verified : t.scholarships.unverified}</Badge>
          {item.openReports > 0 && <Badge tone="warning">{a.reports(item.openReports)}</Badge>}
        </div>
      </div>
      <div className={styles.actions}>
        <Button size="sm" variant="secondary" loading={busy} onClick={() => void run(() => service.patch(item.id, { verification: verified ? "unverified" : "verified" }))}>{verified ? a.unverify : a.verify}</Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void run(() => service.patch(item.id, { status: live ? "hidden" : "active" }))}>{live ? a.hide : a.show}</Button>
        <Button size="sm" variant="tertiary" aria-expanded={panel === "reports"} onClick={() => void openReports()}>{a.seeReports}</Button>
        <Button size="sm" variant="tertiary" aria-expanded={panel === "edit"} onClick={() => setPanel(panel === "edit" ? "none" : "edit")}>{a.edit}</Button>
        <Link className="t-secondary" href={`/scholarships/${item.id}`}>{a.openPublic}</Link>
      </div>
      {failed && <Notice role="alert">{a.actionFailed}</Notice>}
      {panel === "reports" && (
        <div className={styles.panel}>
          {reports === null ? <p className="t-meta">{t.common.loading}</p> : reports.length === 0 ? <p className="t-meta">{a.noReports}</p> : (
            <>
              <ul className={styles.reports}>
                {reports.map((r) => (
                  <li key={r.id} className={r.resolvedAt ? styles.resolved : undefined}>
                    <strong>{t.report.reasons[r.reason] ?? r.reason}</strong> · {formatDate(r.createdAt.slice(0, 10), t.meta.dateLocale, "")}{r.reporter ? ` · ${r.reporter}` : ""}
                    {r.message && <p>{r.message}</p>}
                  </li>
                ))}
              </ul>
              {reports.some((r) => !r.resolvedAt) && <div><Button size="sm" variant="secondary" onClick={() => void run(() => service.resolveReports(item.id))}>{a.resolveReports}</Button></div>}
            </>
          )}
        </div>
      )}
      {panel === "edit" && <JsonEditor service={service} initialId={item.id} initial={toImportFormat(item)} onSaved={() => { setPanel("none"); onChanged(); }} />}
    </li>
  );
}

function JsonEditor({ service, initialId, initial, onSaved }: { service: AdminService; initialId: string; initial: unknown; onSaved: () => void }) {
  const t = useT();
  const a = t.admin;
  const [id, setId] = useState(initialId);
  const [text, setText] = useState(() => JSON.stringify(initial, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    let body: unknown;
    try { body = JSON.parse(text); } catch { setError(a.invalidJson); return; }
    setSaving(true);
    try {
      await service.put(id.trim(), body);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError && e.fields ? a.validation(Object.entries(e.fields).map(([k, v]) => `${k} (${v})`).join(", ")) : a.actionFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.panel} onSubmit={submit} noValidate>
      <TextField label={a.idLabel} value={id} onChange={(e) => setId(e.target.value)} readOnly={Boolean(initialId)} required />
      <TextAreaField label={a.jsonLabel} helper={a.jsonHelper} value={text} onChange={(e) => setText(e.target.value)} rows={18} className={styles.code} spellCheck={false} />
      {error && <Notice role="alert">{error}</Notice>}
      <div><Button type="submit" size="sm" loading={saving}>{a.saveJson}</Button></div>
    </form>
  );
}
