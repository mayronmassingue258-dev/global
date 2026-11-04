# Fotos

| Arquivo | Onde aparece | Tamanho do arquivo | Situação |
|---|---|---|---|
| `hero-student-skyline.jpg` | Topo da página inicial | 768 × 584 | presente |
| `building.jpg` | Página inicial, "Como funciona" (coluna em retrato) | 379 × 583 | presente (recorte do mosaico) |
| `campus.jpg` | Página inicial, fechamento (coluna à direita do texto) | 299 × 437 | presente (recorte do mosaico) |
| `library.jpg` | Assistente de documentos (coluna em retrato) | 299 × 437 | presente (recorte do mosaico) |

As três últimas foram recortadas de um mosaico (1536 × 1024) e são pequenas: em telas grandes ou de alta densidade (Retina)
aparecem um pouco suaves. **Para ficarem nítidas, substitua pelos arquivos originais** com o mesmo nome, de preferência com
1600–2400 px no lado maior. Não é preciso mudar código: em produção, basta um novo deploy.

Outras fotos do mosaico ainda sem uso: Terra à noite vista do espaço, estudantes com notebooks numa escadaria,
mesa com caderno e notebook, e skyline à beira do rio.

- Formato: JPG, qualidade 80–92. O Next.js gera AVIF/WebP e vários tamanhos automaticamente.
- Texto alternativo e enquadramento (`object-position`) ficam em `src/lib/media.ts` (e nos dicionários em `src/i18n`).
- Confirme a licença de uso de cada imagem.
