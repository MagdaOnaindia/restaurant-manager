"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { LayoutDashboard, LogOut, Settings, UserRound } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Spinner } from "@/components/ui";

const NAV = [
  { href: "/app", label: "Inicio", icon: LayoutDashboard },
  { href: "/app/account", label: "Mi cuenta", icon: UserRound },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <aside className="flex w-60 flex-col border-r border-neutral-200 bg-white">
        <div className="flex h-16 items-center gap-2 border-b border-neutral-200 px-5">
          <Settings className="h-5 w-5 text-brand-600" />
          <span className="font-semibold">Restaurant Manager</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                pathname === href
                  ? "bg-brand-50 text-brand-800"
                  : "text-neutral-600 hover:bg-neutral-100",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-neutral-200 p-3">
          <div className="mb-2 px-3 text-sm">
            <div className="font-medium text-neutral-800">{user.name}</div>
            <div className="truncate text-neutral-500">{user.email}</div>
          </div>
          <button
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
