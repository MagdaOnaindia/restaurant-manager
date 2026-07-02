"use client";

import { use, useEffect, useState } from "react";
import { RESERVATION_STATUS_LABELS_ES, type ReservationStatus } from "@rms/shared";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { Alert, Button, Card, Spinner } from "@/components/ui";

interface PublicReservation {
  restaurantName: string;
  date: string;
  time: string;
  partySize: number;
  customerName: string;
  status: ReservationStatus;
}

export default function PublicReservationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [reservation, setReservation] = useState<PublicReservation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    apiGet<{ reservation: PublicReservation }>(`/public/reservations/${token}`)
      .then((r) => setReservation(r.reservation))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "No se pudo cargar la reserva"),
      );
  }, [token]);

  async function cancel() {
    if (!confirm("¿Seguro que quieres cancelar la reserva?")) return;
    setWorking(true);
    try {
      await apiPost(`/public/reservations/${token}/cancel`);
      setCancelled(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cancelar");
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md">
        {error ? (
          <Card>
            <Alert>{error}</Alert>
          </Card>
        ) : !reservation ? (
          <Spinner />
        ) : (
          <Card className="space-y-4 text-center">
            <div className="text-4xl">🍽️</div>
            <h1 className="text-xl font-semibold">Tu reserva en {reservation.restaurantName}</h1>
            <div className="rounded-lg bg-neutral-50 p-4 text-left text-sm">
              <p>
                <strong>Nombre:</strong> {reservation.customerName}
              </p>
              <p>
                <strong>Fecha:</strong> {reservation.date} · <strong>Hora:</strong> {reservation.time}
              </p>
              <p>
                <strong>Personas:</strong> {reservation.partySize}
              </p>
              <p>
                <strong>Estado:</strong> {RESERVATION_STATUS_LABELS_ES[reservation.status]}
              </p>
            </div>
            {cancelled || reservation.status === "CANCELLED" ? (
              <Alert variant="info">Esta reserva está cancelada.</Alert>
            ) : reservation.status === "PENDING" || reservation.status === "CONFIRMED" ? (
              <Button variant="danger" onClick={cancel} loading={working} className="w-full">
                Cancelar reserva
              </Button>
            ) : null}
          </Card>
        )}
      </div>
    </main>
  );
}
