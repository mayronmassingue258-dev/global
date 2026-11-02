// Só o painel tem tela de carregamento. Em rotas com notFound() (detalhe, elegibilidade) um loading.tsx
// faria a resposta começar antes da busca e o status HTTP seria 200 em vez de 404.
export default function Loading() {
  return <p className="t-secondary" role="status">Carregando…</p>;
}
