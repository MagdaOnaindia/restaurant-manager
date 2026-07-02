import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 py-10">
      <Link href="/" className="mb-6 text-xl font-bold text-brand-700">
        Restaurant Manager
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
