import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import type { ReactNode } from "react";
import { PHOTOS, type PhotoKey } from "@/lib/media";
import styles from "./Photo.module.css";

type Props = {
  name: PhotoKey;
  /** Valor de `sizes` do next/image: quanto da tela a foto ocupa em cada largura. */
  sizes: string;
  className?: string;
  priority?: boolean;
  /** Texto alternativo; por padrão usa o de `lib/media.ts`. Use "" quando a foto for decorativa. */
  alt?: string;
  /** Conteúdo do painel mostrado enquanto o arquivo da foto não existir. */
  fallback?: ReactNode;
};

/**
 * Verifica no servidor se o arquivo existe em public/images. Em páginas estáticas isso acontece no build:
 * depois de adicionar uma foto, rode o build de novo (no `npm run dev` basta recarregar a página).
 */
function hasFile(file: string): boolean {
  return existsSync(join(process.cwd(), "public", "images", file));
}

/**
 * Foto otimizada (next/image: AVIF/WebP, tamanhos responsivos, carregamento preguiçoso).
 * Componente de servidor: o contêiner define o tamanho (a imagem usa `fill`).
 */
export function Photo({ name, sizes, className, priority, alt, fallback }: Props) {
  const photo = PHOTOS[name];
  if (!hasFile(photo.file)) {
    return (
      <div className={`${styles.frame} ${styles.fallback} ${className ?? ""}`} aria-hidden="true" data-photo-fallback={name}>
        {fallback}
      </div>
    );
  }
  return (
    <div className={`${styles.frame} ${className ?? ""}`}>
      <Image
        src={`/images/${photo.file}`}
        alt={alt ?? photo.alt}
        fill
        sizes={sizes}
        priority={priority}
        className={styles.image}
        style={{ objectPosition: photo.position }}
      />
    </div>
  );
}
