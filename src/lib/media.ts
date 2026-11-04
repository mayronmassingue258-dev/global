/**
 * Fotos do conjunto do projeto. Coloque os arquivos em `public/images/` com estes nomes:
 * a interface usa a foto assim que o arquivo existir (sem mudar código). Enquanto não existir,
 * aparece um painel editorial no lugar. Tamanho recomendado: 2400 px no lado maior, JPG de qualidade 80+.
 * O Next.js gera versões AVIF/WebP em vários tamanhos automaticamente.
 */
export const PHOTOS = {
  hero: { file: "hero-student-skyline.jpg", alt: "", position: "50% 40%" },
  building: { file: "building.jpg", alt: "Fachada curva de um prédio universitário moderno", position: "40% 50%" },
  library: { file: "library.jpg", alt: "Estudantes trabalhando numa biblioteca com janelas altas", position: "45% 60%" },
  campus: { file: "campus.jpg", alt: "Estudantes caminhando pelo gramado de um campus universitário ao pôr do sol", position: "50% 45%" }
} as const;

export type PhotoKey = keyof typeof PHOTOS;
