"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function ResultInner({ token }: { token: string }) {
  const params = useSearchParams();
  const status = params.get("redirect_status");
  const ok = status === "succeeded" || status === "pending";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-5xl">{ok ? "✅" : "⚠️"}</div>
      <h1 className="text-2xl font-bold">{ok ? "¡Pago completado!" : "El pago no se completó"}</h1>
      <p className="max-w-sm text-neutral-600">
        {ok
          ? "Gracias. En la cuenta de la mesa ya aparece tu pago."
          : "No se ha realizado ningún cargo. Puedes intentarlo de nuevo."}
      </p>
      <Link
        href={`/c/${token}`}
        className="rounded-xl bg-neutral-900 px-6 py-3 font-semibold text-white"
      >
        Volver a la cuenta
      </Link>
    </main>
  );
}

export default function ResultPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  return (
    <Suspense fallback={null}>
      <ResultInner token={token} />
    </Suspense>
  );
}
