/**
 * Fotos do conjunto do projeto. Coloque os arquivos em `public/images/` com estes nomes:
 * a interface usa a foto assim que o arquivo existir (sem mudar código). Enquanto não existir,
 * aparece um painel editorial no lugar. Tamanho recomendado: 2400 px no lado maior, JPG de qualidade 80+.
 * O Next.js gera versões AVIF/WebP em vários tamanhos automaticamente.
 */
export const PHOTOS = {
  hero: { file: "hero-student-skyline.jpg", alt: "", position: "50% 40%" },
  building: { file: "building.jpg", alt: "Fachada de um prédio universitário", position: "50% 50%" },
  library: { file: "library.jpg", alt: "Mesa de estudo em uma biblioteca", position: "50% 50%" },
  campus: { file: "campus.jpg", alt: "Estudantes caminhando por um campus universitário", position: "50% 60%" }
} as const;

export type PhotoKey = keyof typeof PHOTOS;
