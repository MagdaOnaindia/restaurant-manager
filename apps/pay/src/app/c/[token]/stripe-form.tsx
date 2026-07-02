"use client";

import { useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(publishableKey: string) {
  if (!stripePromise) stripePromise = loadStripe(publishableKey);
  return stripePromise;
}

function InnerForm({ returnUrl, onCancel }: { returnUrl: string; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setPaying(true);
    setError(null);
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });
    // Solo llegamos aquí si falla (si no, Stripe redirige)
    setError(result.error.message ?? "No se pudo completar el pago");
    setPaying(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement />
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!stripe || paying}
        className="w-full rounded-xl bg-emerald-600 py-3.5 text-base font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
      >
        {paying ? "Procesando…" : "Pagar"}
      </button>
      <button type="button" onClick={onCancel} className="w-full py-2 text-sm text-neutral-500">
        Volver
      </button>
    </form>
  );
}

export function StripePaymentForm({
  publishableKey,
  clientSecret,
  returnUrl,
  onCancel,
}: {
  publishableKey: string;
  clientSecret: string;
  returnUrl: string;
  onCancel: () => void;
}) {
  return (
    <Elements
      stripe={getStripe(publishableKey)}
      options={{ clientSecret, locale: "es", appearance: { theme: "stripe" } }}
    >
      <InnerForm returnUrl={returnUrl} onCancel={onCancel} />
    </Elements>
  );
}
