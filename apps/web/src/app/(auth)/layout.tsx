import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 py-10">
      <Link href="/" className="mb-8" aria-label="Volver al inicio">
        <Logo markClassName="h-9 w-9" />
      </Link>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-8 text-xs text-neutral-400">Gestión y cobro por QR para hostelería</p>
    </main>
  );
}
