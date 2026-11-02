import { useSyncExternalStore } from "react";
import { vi } from "vitest";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Roteador de teste: `router.replace/push` mudam a URL e os componentes que usam useSearchParams re-renderizam.
 * Chame no início do teste: `const router = setupTestRouter("/assistant?draft=d-1")`.
 */
export function setupTestRouter(initial: string) {
  let url = new URL(initial, "http://test");
  const listeners = new Set<() => void>();
  const navigate = vi.fn((href: string) => {
    url = new URL(href, url);
    listeners.forEach((l) => l());
  });
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  const router = { push: navigate, replace: navigate, back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn(), forward: vi.fn() };

  vi.mocked(useRouter).mockReturnValue(router);
  function usePathnameMock() {
    return useSyncExternalStore(subscribe, () => url.pathname);
  }
  function useSearchParamsMock() {
    const search = useSyncExternalStore(subscribe, () => url.search);
    return new URLSearchParams(search) as ReturnType<typeof useSearchParams>;
  }
  vi.mocked(usePathname).mockImplementation(usePathnameMock);
  vi.mocked(useSearchParams).mockImplementation(useSearchParamsMock);
  return { router, current: () => `${url.pathname}${url.search}` };
}
