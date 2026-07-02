"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiPost, ApiError } from "@/lib/api";
import { Alert, Button, Card, Spinner } from "@/components/ui";

function VerifyEmailInner() {
  const params = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    if (!token) {
      setState("error");
      setMessage("Falta el enlace de verificación.");
      return;
    }
    apiPost("/auth/verify-email", { token })
      .then(() => setState("ok"))
      .catch((err) => {
        setState("error");
        setMessage(err instanceof ApiError ? err.message : "No se pudo verificar el email");
      });
  }, [token]);

  if (state === "loading") return <Spinner />;

  return (
    <Card className="space-y-4 text-center">
      {state === "ok" ? (
        <>
          <div className="text-4xl">✅</div>
          <h1 className="text-xl font-semibold">Email verificado</h1>
          <p className="text-sm text-neutral-600">Tu cuenta ya está activa.</p>
          <Link href="/login">
            <Button className="w-full">Iniciar sesión</Button>
          </Link>
        </>
      ) : (
        <>
          <div className="text-4xl">⚠️</div>
          <h1 className="text-xl font-semibold">No se pudo verificar</h1>
          <Alert>{message}</Alert>
          <p className="text-sm text-neutral-500">
            Puedes pedir un enlace nuevo desde la pantalla de{" "}
            <Link className="font-medium text-brand-700 hover:underline" href="/login">
              inicio de sesión
            </Link>
            .
          </p>
        </>
      )}
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <VerifyEmailInner />
    </Suspense>
  );
}
