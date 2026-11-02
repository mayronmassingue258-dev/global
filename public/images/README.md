# Fotos

| Arquivo | Onde aparece | Situação |
|---|---|---|
| `hero-student-skyline.jpg` | Topo da página inicial | presente (768 px; idealmente trocar por ≥ 2000 px) |
| `building.jpg` | Página inicial, seção "Como funciona" (retrato 4:5) | falta |
| `library.jpg` | Assistente de documentos (4:3) | falta |
| `campus.jpg` | Página inicial, fechamento (faixa larga, texto à esquerda) | falta |

Basta salvar o arquivo com o nome exato nesta pasta: a interface passa a usá-lo sozinha (no `npm run dev`, recarregue;
em produção, faça um novo build). Enquanto não existir, aparece um painel preto editorial no lugar.

- Formato: JPG, lado maior com 2000–2400 px, qualidade 80. O Next.js gera AVIF/WebP e vários tamanhos automaticamente.
- Texto alternativo e enquadramento (`object-position`) ficam em `src/lib/media.ts`.
- Confirme a licença de uso de cada imagem.
