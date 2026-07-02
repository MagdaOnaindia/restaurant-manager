"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { passwordSchema } from "@rms/shared";
import { apiPost, ApiError } from "@/lib/api";
import { Alert, Button, Card, Field, Input, Spinner } from "@/components/ui";

function ResetPasswordInner() {
  const params = useSearchParams();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Contraseña no válida");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    try {
      await apiPost("/auth/reset-password", { token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cambiar la contraseña");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <Card className="space-y-4 text-center">
        <Alert>Falta el enlace de restablecimiento. Pide uno nuevo.</Alert>
        <Link href="/forgot-password" className="text-sm text-brand-700 hover:underline">
          Solicitar enlace
        </Link>
      </Card>
    );
  }

  if (done) {
    return (
      <Card className="space-y-4 text-center">
        <div className="text-4xl">🔒</div>
        <h1 className="text-xl font-semibold">Contraseña actualizada</h1>
        <Link href="/login">
          <Button className="w-full">Iniciar sesión</Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="mb-6 text-xl font-semibold">Nueva contraseña</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Contraseña nueva" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label="Repite la contraseña" htmlFor="confirm">
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <Button type="submit" loading={loading} className="w-full">
          Guardar contraseña
        </Button>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ResetPasswordInner />
    </Suspense>
  );
}
