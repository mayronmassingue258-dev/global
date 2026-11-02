"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { EmptyState, ErrorState, Notice } from "@/components/feedback/States";
import { STUDY_LEVELS } from "@/lib/constants";
import { IS_MOCK_MODE } from "@/lib/config";
import { scholarshipService } from "@/lib/services";
import type { Scholarship, ScholarshipSort } from "@/types";
import patterns from "@/styles/patterns.module.css";
import { ScholarshipCard } from "./ScholarshipCard";
import styles from "./ScholarshipBrowser.module.css";

const PAGE_SIZE = 10;
type Status = "loading" | "ready" | "error";

export function ScholarshipBrowser({ initialQuery }: { initialQuery: string }) {
  const [search, setSearch] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery);
  const [level, setLevel] = useState("");
  const [country, setCountry] = useState("");
  const [sort, setSort] = useState<ScholarshipSort>("deadline");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Scholarship[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    scholarshipService
      .list({ search: debounced, level, country, sort, page, pageSize: PAGE_SIZE }, controller.signal)
      .then((result) => {
        setItems((current) => (page === 1 ? result.items : [...current, ...result.items]));
        setTotal(result.total);
        setStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
  }, [debounced, level, country, sort, page, reloadKey]);

  const hasFilters = Boolean(search || level || country);
  const clear = () => { setSearch(""); setDebounced(""); setLevel(""); setCountry(""); setPage(1); };

  return (
    <div>
      {IS_MOCK_MODE && <div className={styles.toolbar}><Notice>Modo demonstração: os registros abaixo são fictícios e não verificados.</Notice></div>}

      <div className={styles.toolbar}>
        <TextField label="Buscar bolsas" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Nome da bolsa, instituição ou país" />
        <details className={styles.filters}>
          <summary>Filtros e ordenação{level || country ? " (ativos)" : ""}</summary>
          <div className={styles.filterGrid}>
            <SelectField label="Nível de estudo" value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }}>
              <option value="">Todos</option>
              {STUDY_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </SelectField>
            <TextField label="País de destino" value={country} onChange={(e) => { setCountry(e.target.value); setPage(1); }} placeholder="Ex.: Canadá" />
            <SelectField label="Ordenar por" value={sort} onChange={(e) => { setSort(e.target.value as ScholarshipSort); setPage(1); }}>
              <option value="deadline">Prazo mais próximo</option>
              <option value="title">Título (A–Z)</option>
            </SelectField>
          </div>
        </details>
      </div>

      <p className={`t-meta ${styles.count}`} role="status" aria-live="polite">
        {status === "loading" && page === 1 ? "Carregando…" : status === "ready" ? `${total} ${total === 1 ? "resultado" : "resultados"}` : ""}
      </p>

      {status === "error" && <ErrorState onRetry={() => setReloadKey((k) => k + 1)} />}

      {status !== "error" && items.length > 0 && (
        <ul className={patterns.list} aria-busy={status === "loading"}>
          {items.map((item) => <ScholarshipCard key={item.id} item={item} />)}
        </ul>
      )}

      {status === "ready" && items.length === 0 && (
        <EmptyState
          title="Nenhuma bolsa encontrada"
          description="Tente remover filtros ou buscar por outro termo."
          action={hasFilters ? <Button variant="secondary" size="sm" onClick={clear}>Limpar filtros</Button> : undefined}
        />
      )}

      {status !== "error" && items.length < total && (
        <div className={styles.more}>
          <Button variant="secondary" loading={status === "loading"} onClick={() => setPage((p) => p + 1)}>Ver mais resultados</Button>
        </div>
      )}
    </div>
  );
}
