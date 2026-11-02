import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, getDictionary, isLocale, type Locale } from "./config";

/** Idioma do pedido atual (componentes de servidor). Ler o cookie torna a página dinâmica. */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Dicionário do pedido atual (componentes de servidor). */
export async function getT() {
  return getDictionary(await getLocale());
}
