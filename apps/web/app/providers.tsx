"use client";

import { useState, type ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function Providers({ children, session }: { children: ReactNode; session: Session | null }) {
  // Uma instância de QueryClient por montagem do app no client (não compartilha
  // cache entre requisições no SSR). Defaults conservadores para dados sensíveis.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionProvider>
  );
}
