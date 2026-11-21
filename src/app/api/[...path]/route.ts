import { proxyToBackend } from "@/lib/api/proxy";

// Repasse do navegador para o backend (ver lib/api/proxy.ts). Nada aqui é pré-gerado nem guardado em cache.
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };

async function handle(request: Request, { params }: Context) {
  const { path } = await params;
  return proxyToBackend(request, path, { backend: process.env.API_INTERNAL_URL, secret: process.env.INTERNAL_API_SECRET });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
