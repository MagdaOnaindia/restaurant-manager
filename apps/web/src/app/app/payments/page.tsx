"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, RefreshCcw } from "lucide-react";
import { roleAtLeast } from "@rms/shared";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useOrg } from "@/components/org-provider";
import { Alert, Button, Card, Spinner } from "@/components/ui";

interface StripeStatus {
  configured: boolean;
  connected: boolean;
  chargesEnabled: boolean;
}

export default function PaymentsPage() {
  const { activeOrg, reload } = useOrg();
  useAuth();
  const orgId = activeOrg?.id;
  const isOwner = activeOrg?.role === "OWNER";
  const canView = activeOrg ? roleAtLeast(activeOrg.role, "ADMIN") : false;

  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    if (!orgId || !canView) return;
    const s = await apiGet<StripeStatus>(`/orgs/${orgId}/stripe/status`);
    setStatus(s);
  }, [orgId, canView]);

  useEffect(() => {
    void load();
  }, [load]);

  async function startOnboarding() {
    setError(null);
    setWorking(true);
    try {
      const { url } = await apiPost<{ url: string }>(`/orgs/${orgId}/stripe/onboarding-link`);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar la configuración");
      setWorking(false);
    }
  }

  async function sync() {
    setError(null);
    setWorking(true);
    try {
      await apiPost(`/orgs/${orgId}/stripe/sync`);
      await Promise.all([load(), reload()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo sincronizar");
    } finally {
      setWorking(false);
    }
  }

  if (!canView) return <Alert variant="info">Solo administración puede ver los cobros.</Alert>;
  if (!status) return <Spinner />;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Cobros · {activeOrg?.name}</h1>
      {error && <Alert>{error}</Alert>}

      <Card>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100">
            <CreditCard className="h-6 w-6 text-brand-700" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Cobro dividido por QR</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Con los cobros activados, tus clientes escanean el QR de la mesa, dividen la cuenta y
              pagan con tarjeta, Apple Pay, Google Pay o Bizum. El dinero llega directamente a la
              cuenta de tu negocio a través de Stripe.
            </p>

            <div className="mt-4">
              {!status.configured ? (
                <Alert variant="info">
                  La plataforma aún no tiene las claves de Stripe configuradas (modo test). Añade
                  <code className="mx-1">STRIPE_SECRET_KEY</code> en <code>apps/api/.env</code> y
                  reinicia la API.
                </Alert>
              ) : status.chargesEnabled ? (
                <Alert variant="success">
                  ✅ Cobros activados. Tus clientes ya pueden pagar por QR.
                </Alert>
              ) : status.connected ? (
                <Alert variant="info">
                  La cuenta de Stripe está creada pero el alta no está completa. Continúa el proceso
                  o sincroniza el estado.
                </Alert>
              ) : (
                <Alert variant="info">Todavía no has configurado los cobros.</Alert>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {status.configured && isOwner && !status.chargesEnabled && (
                <Button onClick={startOnboarding} loading={working}>
                  {status.connected ? "Continuar configuración" : "Configurar cobros con Stripe"}
                </Button>
              )}
              {status.configured && status.connected && (
                <Button variant="secondary" onClick={sync} loading={working}>
                  <RefreshCcw className="h-4 w-4" /> Sincronizar estado
                </Button>
              )}
            </div>
            {!isOwner && !status.chargesEnabled && (
              <p className="mt-3 text-sm text-neutral-500">
                Solo la persona propietaria de la organización puede completar el alta en Stripe.
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
