"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ResolveTableView } from "@rms/shared";
import { apiGet, ApiError } from "@/lib/api";

export default function TableResolvePage({ params }: { params: Promise<{ qrCode: string }> }) {
  const { qrCode } = use(params);
  const router = useRouter();
  const [state, setState] = useState<"loading" | "no-check" | "error">("loading");
  const [info, setInfo] = useState<ResolveTableView | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const view = await apiGet<ResolveTableView>(`/pay/t/${qrCode}`);
        if (cancelled) return;
        setInfo(view);
        if (view.checkToken) {
          router.replace(`/c/${view.checkToken}`);
        } else {
          setState("no-check");
          // Reintenta cada 5s: el camarero puede abrir la cuenta en cualquier momento
          setTimeout(poll, 5000);
        }
      } catch (err) {
        if (cancelled) return;
        setState("error");
        setError(err instanceof ApiError ? err.message : "No se pudo cargar la mesa");
      }
    }
    void poll();
    return () => {
      cancelled = true;
    };
  }, [qrCode, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      {state === "loading" && <div className="animate-pulse text-4xl">🧾</div>}
      {state === "no-check" && (
        <>
          <div className="text-5xl">👋</div>
          <h1 className="text-2xl font-bold">
            {info?.tableName} · {info?.restaurantName}
          </h1>
          <p className="max-w-sm text-neutral-600">
            Esta mesa todavía no tiene la cuenta abierta. Pide al personal que la abra y esta
            pantalla se actualizará sola.
          </p>
        </>
      )}
      {state === "error" && (
        <>
          <div className="text-5xl">⚠️</div>
          <p className="max-w-sm text-neutral-600">{error}</p>
        </>
      )}
    </main>
  );
}
