"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { PublicInvitationInfo } from "@rms/shared";
import { ORG_ROLE_LABELS_ES } from "@rms/shared";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Alert, Button, Card, Field, Input, Spinner } from "@/components/ui";

function InvitationInner() {
  const params = useSearchParams();
  const token = params.get("token");
  const router = useRouter();
  const { user, loading: authLoading, reload } = useAuth();

  const [info, setInfo] = useState<PublicInvitationInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", password: "" });
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Falta el enlace de invitación.");
      return;
    }
    apiGet<{ invitation: PublicInvitationInfo }>(`/invitations/${token}`)
      .then((r) => setInfo(r.invitation))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "No se pudo cargar la invitación"),
      );
  }, [token]);

  async function acceptExisting() {
    setWorking(true);
    setError(null);
    try {
      await apiPost("/invitations/accept", { token });
      router.replace("/app");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo aceptar la invitación");
      setWorking(false);
    }
  }

  async function acceptNew(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setError(null);
    try {
      await apiPost("/invitations/accept-new", { token, ...form });
      await reload();
      router.replace("/app");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la cuenta");
      setWorking(false);
    }
  }

  if (error && !info) {
    return (
      <Card className="space-y-4 text-center">
        <Alert>{error}</Alert>
        <Link href="/" className="text-sm text-brand-700 hover:underline">
          Ir al inicio
        </Link>
      </Card>
    );
  }

  if (!info || authLoading) return <Spinner />;

  return (
    <Card className="space-y-4">
      <div className="text-center">
        <div className="text-4xl">🤝</div>
        <h1 className="mt-2 text-xl font-semibold">Únete a {info.organizationName}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {info.invitedByName} te ha invitado como{" "}
          <strong>{ORG_ROLE_LABELS_ES[info.role]}</strong>.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      {user ? (
        user.email === info.email ? (
          <Button onClick={acceptExisting} loading={working} className="w-full">
            Aceptar invitación
          </Button>
        ) : (
          <Alert variant="info">
            La invitación es para <strong>{info.email}</strong>, pero has iniciado sesión como{" "}
            <strong>{user.email}</strong>. Cierra sesión y vuelve a abrir el enlace.
          </Alert>
        )
      ) : info.userExists ? (
        <div className="space-y-3 text-center">
          <p className="text-sm text-neutral-600">
            Ya tienes una cuenta con <strong>{info.email}</strong>. Inicia sesión para aceptar.
          </p>
          <Link href={`/login?next=${encodeURIComponent(`/invitation?token=${token}`)}`}>
            <Button className="w-full">Iniciar sesión</Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={acceptNew} className="space-y-4">
          <Field label="Email">
            <Input value={info.email} disabled />
          </Field>
          <Field label="Tu nombre" htmlFor="name">
            <Input
              id="name"
              required
              minLength={2}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Crea una contraseña" htmlFor="password">
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>
          <Button type="submit" loading={working} className="w-full">
            Crear cuenta y unirme
          </Button>
        </form>
      )}
    </Card>
  );
}

export default function InvitationPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <InvitationInner />
    </Suspense>
  );
}
