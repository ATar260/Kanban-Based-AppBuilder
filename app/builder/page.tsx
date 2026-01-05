"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BuilderPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/generation");
  }, [router]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-black-alpha-56">Redirecting…</p>
      </div>
    </div>
  );
}