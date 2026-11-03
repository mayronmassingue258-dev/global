"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Link2, SearchX, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { EmptyState, ErrorState, Notice } from "@/components/feedback/States";
import { ListSkeleton } from "@/components/feedback/Skeleton";
import { useT } from "@/i18n/I18nProvider";
import { STUDY_LEVELS } from "@/lib/constants";
import { IS_MOCK_MODE } from "@/lib/config";
import { scholarshipService } from "@/lib/services";
import { readSearchFilters, writeSearchFilters, type SearchFilters } from "@/lib/searchParams";
import type { Scholarship } from "@/types";
import patterns from "@/styles/patterns.module.css";
import { ScholarshipCard } from "./ScholarshipCard";
import styles from "./ScholarshipBrowser.module.css";

const PAGE_SIZE = 10;
const TYPING_DELAY_MS = 300;
type Status = "loading" | "ready" | "error";

/**
 * Busca com filtros guardados na URL (?q=&level=&country=&sort=): o link pode ser compartilhado,
 * e voltar/avançar no navegador restaura a busca. A paginação ("Ver mais") não vai para a URL.
 */
export function ScholarshipBrowser() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname() ?? "/scholarships";
  const params = useSearchParams();
  const filters = readSearchFilters(params);
  const filtersKey = writeSearchFilters(filters).toString();

  // Campos de texto: o que está sendo digitado vai para a URL após uma pausa.
  const [search, setSearch] = useState(filters.q);
  const [country, setCountry] = useState(filters.country);
  // Voltar/avançar (ou um chip removido) muda a URL: os campos acompanham.
  // Só substitui se o conteúdo for outro (não apaga um espaço que a pessoa acabou de digitar).
  useEffect(() => setSearch((current) => (current.trim() === filters.q ? current : filters.q)), [filters.q]);
  useEffect(() => setCountry((current) => (current.trim() === filters.country ? current : filters.country)), [filters.country]);

  /**
   * Filtros escolhidos (nível, ordem, chips) criam uma entrada no histórico: "voltar" desfaz o último filtro.
   * Texto digitado só substitui a entrada atual, para não criar uma entrada a cada pausa na digitação.
   */
  const navigate = (next: Partial<SearchFilters>, mode: "push" | "replace" = "push") => {
    const query = writeSearchFilters({ ...filters, ...next }).toString();
    router[mode](query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (search.trim() === filters.q && country.trim() === filters.country) return;
    const timer = setTimeout(() => navigate({ q: search.trim(), country: country.trim() }, "replace"), TYPING_DELAY_MS);
    return () => clearTimeout(timer);
    // navigate muda a cada render; só os textos digitados devem disparar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, country]);

  // Página atual ligada ao conjunto de filtros: mudar um filtro volta para a página 1 sem um efeito extra.
  const [paging, setPaging] = useState({ key: filtersKey, page: 1 });
  const page = paging.key === filtersKey ? paging.page : 1;

  const [items, setItems] = useState<Scholarship[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    scholarshipService
      .list({ search: filters.q, level: filters.level, country: filters.country, sort: filters.sort, page, pageSize: PAGE_SIZE }, controller.signal)
      .then((result) => {
        setItems((current) => (page === 1 ? result.items : [...current, ...result.items]));
        setTotal(result.total);
        setStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
    // filtersKey resume os filtros.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, page, reloadKey]);

  const levelLabel = (value: string) => t.levels[value] ?? value;
  const chips: { key: keyof SearchFilters; label: string }[] = [
    ...(filters.q ? [{ key: "q" as const, label: t.scholarships.chipSearch(filters.q) }] : []),
    ...(filters.level ? [{ key: "level" as const, label: t.scholarships.chipLevel(levelLabel(filters.level)) }] : []),
    ...(filters.country ? [{ key: "country" as const, label: t.scholarships.chipCountry(filters.country) }] : []),
    ...(filters.sort === "title" ? [{ key: "sort" as const, label: t.scholarships.chipSort }] : [])
  ];
  const removeChip = (key: keyof SearchFilters) => navigate({ [key]: key === "sort" ? "deadline" : "" });
  const clearAll = () => {
    setSearch("");
    setCountry("");
    router.push(pathname, { scroll: false });
  };

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  const filtersOpen = Boolean(filters.level || filters.country || filters.sort === "title");

  return (
    <div>
      {IS_MOCK_MODE && <div className={styles.toolbar}><Notice>{t.scholarships.demoNotice}</Notice></div>}

      <div className={styles.toolbar}>
        <TextField label={t.scholarships.searchLabel} type="search" name="q" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.scholarships.searchPlaceholder} />
        <details className={styles.filters} open={filtersOpen || undefined}>
          <summary>{t.scholarships.filters}{filtersOpen ? ` ${t.scholarships.filtersActive}` : ""}</summary>
          <div className={styles.filterGrid}>
            <SelectField label={t.scholarships.level} value={filters.level} onChange={(e) => navigate({ level: e.target.value })}>
              <option value="">{t.scholarships.all}</option>
              {STUDY_LEVELS.map((l) => <option key={l} value={l}>{levelLabel(l)}</option>)}
            </SelectField>
            <TextField label={t.scholarships.country} value={country} onChange={(e) => setCountry(e.target.value)} placeholder={t.scholarships.countryPlaceholder} />
            <SelectField label={t.scholarships.sort} value={filters.sort} onChange={(e) => navigate({ sort: e.target.value === "title" ? "title" : "deadline" })}>
              <option value="deadline">{t.scholarships.sortDeadline}</option>
              <option value="title">{t.scholarships.sortTitle}</option>
            </SelectField>
          </div>
        </details>
      </div>

      {chips.length > 0 && (
        <div className={styles.chips}>
          <span className="visually-hidden">{t.scholarships.activeFilters}</span>
          <ul aria-label={t.scholarships.activeFilters}>
            {chips.map((chip) => (
              <li key={chip.key}>
                <button type="button" className={styles.chip} aria-label={t.scholarships.removeFilter(chip.label)} onClick={() => removeChip(chip.key)}>
                  {chip.label}
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <Button variant="tertiary" size="sm" onClick={clearAll}>{t.scholarships.clearAll}</Button>
        </div>
      )}

      <div className={styles.countRow}>
        <p className="t-meta" role="status" aria-live="polite">
          {status === "loading" && page === 1 ? t.common.loading : status === "ready" ? t.scholarships.results(total) : ""}
        </p>
        {chips.length > 0 && (
          <button type="button" className={styles.copy} onClick={() => void copyLink()}>
            <Link2 size={14} aria-hidden="true" />
            <span aria-live="polite">{copied ? t.scholarships.linkCopied : t.scholarships.copyLink}</span>
          </button>
        )}
      </div>

      {status === "error" && <ErrorState onRetry={() => setReloadKey((k) => k + 1)} />}

      {status === "loading" && page === 1 && <ListSkeleton rows={4} variant="card" />}

      {status !== "error" && !(status === "loading" && page === 1) && items.length > 0 && (
        <ul className={patterns.list} aria-busy={status === "loading"}>
          {items.map((item) => <ScholarshipCard key={item.id} item={item} headingLevel={2} />)}
        </ul>
      )}

      {status === "ready" && items.length === 0 && (
        <EmptyState
          icon={SearchX}
          title={t.scholarships.emptyTitle}
          description={t.scholarships.emptyText}
          action={chips.length > 0 ? <Button variant="secondary" size="sm" onClick={clearAll}>{t.scholarships.clearFilters}</Button> : undefined}
        />
      )}

      {status !== "error" && items.length > 0 && items.length < total && (
        <div className={styles.more}>
          <Button variant="secondary" loading={status === "loading"} onClick={() => setPaging({ key: filtersKey, page: page + 1 })}>{t.scholarships.more}</Button>
        </div>
      )}
    </div>
  );
}
