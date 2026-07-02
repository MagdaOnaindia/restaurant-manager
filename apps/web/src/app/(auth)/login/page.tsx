"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { AuthUser } from "@rms/shared";
import { apiPost, ApiError } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Alert, Button, Card, Field, Input, Spinner } from "@/components/ui";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  // Solo aceptamos rutas internas como destino post-login
  const rawNext = params.get("next");
  const next = rawNext && rawNext.startsWith("/") ? rawNext : "/app";
  const { setUser } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [notVerified, setNotVerified] = useState(false);
  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotVerified(false);
    setLoading(true);
    try {
      const { user } = await apiPost<{ user: AuthUser }>("/auth/login", {
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      setUser(user);
      router.replace(next);
    } catch (err) {
      if (err instanceof ApiError && err.code === "EMAIL_NOT_VERIFIED") {
        setNotVerified(true);
      } else {
        setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión");
      }
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    try {
      await apiPost("/auth/resend-verification", { email: form.email.trim().toLowerCase() });
      setResent(true);
    } catch {
      /* silencioso */
    }
  }

  return (
    <Card>
      <h1 className="mb-6 text-xl font-semibold">Iniciar sesión</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        {notVerified && (
          <Alert variant="info">
            Tu email aún no está verificado. Revisa tu bandeja de entrada.{" "}
            {resent ? (
              <strong>Enlace reenviado.</strong>
            ) : (
              <button type="button" onClick={resend} className="font-medium underline">
                Reenviar enlace
              </button>
            )}
          </Alert>
        )}
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Contraseña" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        <div className="text-right">
          <Link href="/forgot-password" className="text-sm text-brand-700 hover:underline">
            ¿Has olvidado tu contraseña?
          </Link>
        </div>
        <Button type="submit" loading={loading} className="w-full">
          Entrar
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-neutral-500">
        ¿No tienes cuenta?{" "}
        <Link className="font-medium text-brand-700 hover:underline" href="/register">
          Regístrate
        </Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <LoginInner />
    </Suspense>
  );
}
