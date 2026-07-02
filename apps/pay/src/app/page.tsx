export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-5xl">🧾</div>
      <h1 className="text-2xl font-bold">Pago en mesa</h1>
      <p className="max-w-sm text-neutral-600">
        Escanea el código QR de tu mesa para ver la cuenta y pagar tu parte.
      </p>
      <p className="text-sm text-neutral-400">Próximamente</p>
    </main>
  );
}
