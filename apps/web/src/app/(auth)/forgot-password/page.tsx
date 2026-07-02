"use client";

import { useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/api";
import { Alert, Button, Card, Field, Input } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiPost("/auth/forgot-password", { email: email.trim().toLowerCase() });
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <h1 className="mb-1 text-xl font-semibold">Restablecer contraseña</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Te enviaremos un enlace para crear una contraseña nueva.
      </p>
      {done ? (
        <div className="space-y-4">
          <Alert variant="success">
            Si existe una cuenta con <strong>{email}</strong>, recibirás un email con el enlace en unos
            segundos.
          </Alert>
          <Link href="/login" className="block text-center text-sm text-brand-700 hover:underline">
            Volver a inicio de sesión
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button type="submit" loading={loading} className="w-full">
            Enviar enlace
          </Button>
        </form>
      )}
    </Card>
  );
}
