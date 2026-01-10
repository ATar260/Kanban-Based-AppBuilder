"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BuilderPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/generation");
  }, [router]);

  return (
    <div className="min-h-screen bg-comfort-sage-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-comfort-sage-200 border-t-comfort-sage-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-comfort-charcoal-500">Redirecting…</p>
      </div>
    </div>
  );
}