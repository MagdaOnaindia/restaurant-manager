"use client";

import { useState } from "react";
import Link from "next/link";
import { registerSchema } from "@rms/shared";
import { apiPost, ApiError } from "@/lib/api";
import { Alert, Button, Card, Field, Input } from "@/components/ui";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [resent, setResent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[issue.path.join(".")] = issue.message;
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    try {
      await apiPost("/auth/register", parsed.data);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo completar el registro");
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

  if (done) {
    return (
      <Card className="space-y-4 text-center">
        <div className="text-4xl">📬</div>
        <h1 className="text-xl font-semibold">Revisa tu email</h1>
        <p className="text-sm text-neutral-600">
          Te hemos enviado un enlace de verificación a <strong>{form.email}</strong>. Ábrelo para
          activar tu cuenta.
        </p>
        {resent ? (
          <Alert variant="success">Enlace reenviado.</Alert>
        ) : (
          <Button variant="secondary" onClick={resend}>
            Reenviar enlace
          </Button>
        )}
        <p className="text-sm text-neutral-500">
          ¿Ya has verificado?{" "}
          <Link className="font-medium text-brand-700 hover:underline" href="/login">
            Inicia sesión
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="mb-1 text-xl font-semibold">Crear cuenta</h1>
      <p className="mb-6 text-sm text-neutral-500">Empieza a gestionar tu restaurante en minutos.</p>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Nombre" htmlFor="name" error={fieldErrors["name"]}>
          <Input
            id="name"
            autoComplete="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Email" htmlFor="email" error={fieldErrors["email"]}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Contraseña" htmlFor="password" error={fieldErrors["password"]}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        <Button type="submit" loading={loading} className="w-full">
          Crear cuenta
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-neutral-500">
        ¿Ya tienes cuenta?{" "}
        <Link className="font-medium text-brand-700 hover:underline" href="/login">
          Inicia sesión
        </Link>
      </p>
    </Card>
  );
}
