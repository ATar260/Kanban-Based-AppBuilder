"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UsageLoadingText } from "@/components/shared/loading/usage-loading";

type ApiUsageResponse =
  | {
      success: true;
      actor: { tier: string; isAuthenticated: boolean };
      usage: {
        limits: { aiGenerationsPerMonth: number | null; sandboxMinutesPerMonth: number | null };
        used: { aiGenerations: number; sandboxMinutes: number };
        exceeded: { aiGenerations: boolean; sandboxMinutes: boolean };
      };
      upgradeUrl?: string;
    }
  | { success: false; error: string };

export function UsagePill({ className = "" }: { className?: string }) {
  const [data, setData] = useState<ApiUsageResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/usage", { method: "GET", cache: "no-store" });
        const json = (await res.json().catch(() => null)) as ApiUsageResponse | null;
        if (!cancelled && json) setData(json);
      } catch {
        if (!cancelled) setData({ success: false, error: "Failed to load usage" });
      }
    };

    load();
    const interval = window.setInterval(load, 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  if (!data) return <UsageLoadingText text="Usage…" />;
  if (!data.success) return null;

  const tier = (data.actor?.tier || "free").toUpperCase();
  const aiLimit = data.usage.limits.aiGenerationsPerMonth;
  const sbLimit = data.usage.limits.sandboxMinutesPerMonth;

  const aiText = aiLimit === null ? `${data.usage.used.aiGenerations}` : `${data.usage.used.aiGenerations}/${aiLimit}`;
  const sbText = sbLimit === null ? `${data.usage.used.sandboxMinutes}` : `${data.usage.used.sandboxMinutes}/${sbLimit}`;

  const exceeded = Boolean(data.usage.exceeded.aiGenerations || data.usage.exceeded.sandboxMinutes);

  return (
    <div
      className={`flex items-center gap-2 text-[11px] px-2 py-1 rounded-lg border ${
        exceeded ? "bg-red-50 border-red-200 text-red-700" : "bg-gray-50 border-gray-200 text-gray-700"
      } ${className}`}
      title="Monthly usage"
    >
      <span className="font-semibold">{tier}</span>
      <span className="text-gray-400">•</span>
      <span>AI {aiText}</span>
      <span className="text-gray-400">•</span>
      <span>SB {sbText}m</span>
      {exceeded && data.upgradeUrl ? (
        <>
          <span className="text-gray-400">•</span>
          <Link href={data.upgradeUrl} className="underline underline-offset-2">
            Upgrade
          </Link>
        </>
      ) : null}
    </div>
  );
}

