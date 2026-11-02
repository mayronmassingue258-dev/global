"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/feedback/States";
import patterns from "@/styles/patterns.module.css";
import styles from "./AssistantWorkspace.module.css";

const TASKS = ["Carta de motivação", "Currículo acadêmico", "Declaração pessoal", "Revisão de documento"] as const;

/**
 * DEMONSTRAÇÃO: monta um roteiro local a partir do que o estudante escreveu.
 * Nenhum serviço de IA está conectado e nenhuma informação é inventada.
 */
export function AssistantWorkspace() {
  const [task, setTask] = useState<(typeof TASKS)[number]>(TASKS[0]);
  const [program, setProgram] = useState("");
  const [details, setDetails] = useState("");
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");

  function generate() {
    if (!details.trim()) {
      setMessage("Descreva sua experiência real antes de criar o roteiro.");
      return;
    }
    setDraft(
      `${task.toUpperCase()} — ROTEIRO DE TRABALHO\n\nPrograma: ${program.trim() || "[informe o programa exato]"}\n\nSeu histórico (conforme você escreveu):\n${details.trim()}\n\nEstrutura sugerida:\n1. Sua motivação acadêmica\n2. Experiência relevante e evidências\n3. Por que este programa é adequado\n4. Seus objetivos após o programa\n\nEste é um roteiro, não um documento gerado por IA. Revise cada afirmação e inclua apenas informações verdadeiras.`
    );
    setMessage("Roteiro básico criado localmente. Nenhum serviço de IA está conectado.");
  }

  async function copy() {
    if (!draft) { setMessage("Não há nada para copiar."); return; }
    try {
      await navigator.clipboard.writeText(draft);
      setMessage("Rascunho copiado.");
    } catch {
      setMessage("Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.");
    }
  }

  return (
    <div className={styles.grid}>
      <section className={patterns.panel} aria-labelledby="a-task">
        <h2 id="a-task" className="t-component">Dados do documento</h2>
        <fieldset className={styles.tasks}>
          <legend>O que você quer preparar?</legend>
          <div className={styles.taskRow}>
            {TASKS.map((t) => (
              <label key={t} className={styles.task}>
                <input type="radio" name="task" value={t} checked={task === t} onChange={() => setTask(t)} />
                <span>{t}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <TextField label="Bolsa ou programa" value={program} onChange={(e) => setProgram(e.target.value)} placeholder="Ex.: Mestrado em Ciência de Dados" />
        <TextAreaField label="Sua experiência real e seus objetivos" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Formação, projetos, conquistas e objetivos. Não invente nem exagere." />
        <div><Button onClick={generate}>Criar roteiro</Button></div>
      </section>

      <section className={patterns.panel} aria-labelledby="a-draft">
        <div className={patterns.sectionHead}>
          <h2 id="a-draft" className="t-component">Rascunho editável</h2>
          <Badge tone="outline">Demonstração local</Badge>
        </div>
        <TextAreaField label="Conteúdo do rascunho" className={styles.draft} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="O roteiro aparecerá aqui." />
        <div className={patterns.actions}><Button variant="secondary" onClick={copy}>Copiar rascunho</Button></div>
        {message && <Notice role="status">{message}</Notice>}
      </section>
    </div>
  );
}
