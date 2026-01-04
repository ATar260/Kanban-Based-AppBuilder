"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

const isAuthConfigured = !!(
  process.env.NEXT_PUBLIC_AUTH_ENABLED === "true" ||
  (typeof window !== "undefined" && (window as any).__AUTH_CONFIGURED__)
);

export function SessionProvider({ children }: Props) {
  if (!isAuthConfigured) {
    return <>{children}</>;
  }
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
