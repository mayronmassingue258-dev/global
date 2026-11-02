import type { DocumentType } from "@/types";

export type SectionTemplate = { key: string; title: string; hint: string; targetWords: [number, number] };
export type DocumentTemplate = { type: DocumentType; label: string; description: string; sections: SectionTemplate[] };

/**
 * Estruturas de documento. São orientações de escrita, não texto gerado: o estudante escreve tudo.
 * As faixas de palavras são referências gerais; o edital da bolsa sempre prevalece.
 */
export const TEMPLATES: Record<DocumentType, DocumentTemplate> = {
  motivation_letter: {
    type: "motivation_letter",
    label: "Carta de motivação",
    description: "Por que este programa, por que você, por que agora.",
    sections: [
      { key: "opening", title: "Abertura", hint: "Diga a que programa você se candidata e a ideia central da carta em duas ou três frases.", targetWords: [40, 90] },
      { key: "motivation", title: "Motivação acadêmica", hint: "O que despertou seu interesse pela área? Um momento concreto vale mais que adjetivos.", targetWords: [80, 160] },
      { key: "evidence", title: "Experiência e evidências", hint: "Projetos, pesquisas, trabalho ou voluntariado que mostram preparo. Use números e resultados reais.", targetWords: [120, 220] },
      { key: "fit", title: "Por que este programa", hint: "Disciplinas, professores, laboratórios ou parcerias específicas que se conectam ao seu plano.", targetWords: [80, 160] },
      { key: "goals", title: "Objetivos", hint: "O que você pretende fazer depois, e como isso beneficia sua comunidade ou área.", targetWords: [60, 140] },
      { key: "closing", title: "Fechamento", hint: "Retome a ideia central e agradeça a consideração, sem repetir o currículo.", targetWords: [30, 70] }
    ]
  },
  academic_cv: {
    type: "academic_cv",
    label: "Currículo acadêmico",
    description: "Formação, pesquisa e conquistas em ordem clara.",
    sections: [
      { key: "education", title: "Formação", hint: "Curso, instituição, período e resultado (com a escala). Do mais recente para o mais antigo.", targetWords: [30, 120] },
      { key: "research", title: "Pesquisa e projetos", hint: "Título, seu papel, período e o que foi produzido.", targetWords: [40, 200] },
      { key: "experience", title: "Experiência", hint: "Estágios, monitorias, trabalho. Um verbo de ação e um resultado por linha.", targetWords: [40, 200] },
      { key: "awards", title: "Prêmios e bolsas", hint: "Nome, quem concedeu e o ano.", targetWords: [0, 100] },
      { key: "languages", title: "Idiomas", hint: "Idioma e nível (de preferência com certificado e nota).", targetWords: [5, 50] },
      { key: "skills", title: "Competências", hint: "Ferramentas, métodos e técnicas que você realmente domina.", targetWords: [10, 80] }
    ]
  },
  personal_statement: {
    type: "personal_statement",
    label: "Declaração pessoal",
    description: "Sua trajetória e o que ela diz sobre você.",
    sections: [
      { key: "origin", title: "De onde você vem", hint: "Contexto que ajuda a entender seu caminho. Escolha o que for relevante, não tudo.", targetWords: [80, 160] },
      { key: "challenge", title: "Um desafio", hint: "Uma situação difícil e o que você fez a respeito.", targetWords: [100, 200] },
      { key: "learning", title: "O que aprendeu", hint: "Como isso mudou sua forma de estudar, trabalhar ou decidir.", targetWords: [80, 160] },
      { key: "future", title: "Para onde vai", hint: "Como a bolsa se encaixa no próximo passo.", targetWords: [60, 140] }
    ]
  },
  document_review: {
    type: "document_review",
    label: "Revisão de documento",
    description: "Cole um texto e anote o que revisar.",
    sections: [
      { key: "original", title: "Texto", hint: "Cole aqui o texto que você quer revisar.", targetWords: [0, 1000] },
      { key: "checklist", title: "Pontos a revisar", hint: "Anote: o texto responde à pergunta do edital? Cada afirmação é verdadeira e tem evidência? Está dentro do limite?", targetWords: [0, 300] }
    ]
  }
};

export const TEMPLATE_LIST = Object.values(TEMPLATES);

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Documento inteiro em texto simples, com títulos de seção, para copiar. Seções vazias ficam de fora. */
export function toPlainText(title: string, type: DocumentType, sections: Record<string, string>): string {
  const parts = TEMPLATES[type].sections
    .filter((s) => sections[s.key]?.trim())
    .map((s) => `${s.title.toUpperCase()}\n\n${sections[s.key]!.trim()}`);
  return [title.trim(), ...parts].join("\n\n\n");
}
