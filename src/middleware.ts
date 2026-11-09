import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, loginUrl } from "@/lib/auth/routes";

/**
 * Áreas privadas: sem cookie de sessão, vai direto para o login (e volta depois, via ?next=).
 * É só uma triagem rápida; quem valida a sessão de verdade é o backend (401 → login, ver lib/api/client.ts).
 * No modo demonstração (sem servidor) não há login.
 */
export function middleware(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_DATA_MODE === "mock") return NextResponse.next();
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  return NextResponse.redirect(new URL(loginUrl(`${pathname}${search}`), request.url));
}

// Lista fixa (o Next lê este valor sem executar o código). Mantenha igual a PROTECTED_PREFIXES em lib/auth/routes.ts —
// um teste verifica isso.
export const config = {
  matcher: [
    "/dashboard", "/dashboard/:path*",
    "/applications", "/applications/:path*",
    "/profile", "/profile/:path*",
    "/assistant", "/assistant/:path*",
    "/eligibility", "/eligibility/:path*",
    "/account", "/account/:path*"
  ]
};
