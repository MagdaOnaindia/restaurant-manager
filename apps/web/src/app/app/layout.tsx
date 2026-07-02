"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  Armchair,
  CalendarDays,
  ChefHat,
  LayoutDashboard,
  LogOut,
  NotebookText,
  Store,
  UserRound,
  Users,
} from "lucide-react";
import { roleAtLeast } from "@rms/shared";
import { useAuth } from "@/components/auth-provider";
import { OrgProvider, useOrg } from "@/components/org-provider";
import { Spinner } from "@/components/ui";

function Sidebar() {
  const { user, logout } = useAuth();
  const { organizations, activeOrg, activeRestaurant, setActiveOrgId, setActiveRestaurantId } =
    useOrg();
  const router = useRouter();
  const pathname = usePathname();

  const nav = [
    { href: "/app", label: "Inicio", icon: LayoutDashboard, show: true },
    { href: "/app/tables", label: "Mesas", icon: Armchair, show: true },
    { href: "/app/menus", label: "Cartas", icon: NotebookText, show: true },
    { href: "/app/reservations", label: "Reservas", icon: CalendarDays, show: true },
    {
      href: "/app/team",
      label: "Equipo",
      icon: Users,
      show: activeOrg ? roleAtLeast(activeOrg.role, "ADMIN") : false,
    },
    { href: "/app/account", label: "Mi cuenta", icon: UserRound, show: true },
  ].filter((i) => i.show);

  return (
    <aside className="flex w-64 flex-col border-r border-neutral-200 bg-white print:hidden">
      <div className="flex h-16 items-center gap-2 border-b border-neutral-200 px-5">
        <ChefHat className="h-5 w-5 text-brand-600" />
        <span className="font-semibold">Restaurant Manager</span>
      </div>

      {activeOrg && (
        <div className="space-y-2 border-b border-neutral-200 p-3">
          {organizations.length > 1 ? (
            <select
              value={activeOrg.id}
              onChange={(e) => setActiveOrgId(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
            >
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="px-1 text-sm font-semibold text-neutral-800">{activeOrg.name}</div>
          )}

          {activeOrg.restaurants.length > 0 && (
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 shrink-0 text-neutral-400" />
              {activeOrg.restaurants.length > 1 ? (
                <select
                  value={activeRestaurant?.id ?? ""}
                  onChange={(e) => setActiveRestaurantId(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                >
                  {activeOrg.restaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="truncate text-sm text-neutral-600">{activeRestaurant?.name}</span>
              )}
            </div>
          )}
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
              pathname === href || (href !== "/app" && pathname.startsWith(href))
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
          <div className="font-medium text-neutral-800">{user?.name}</div>
          <div className="truncate text-neutral-500">{user?.email}</div>
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
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { organizations, loading } = useOrg();
  const router = useRouter();
  const pathname = usePathname();
  const isOnboarding = pathname.startsWith("/app/onboarding");

  useEffect(() => {
    if (!loading && organizations.length === 0 && !isOnboarding) {
      router.replace("/app/onboarding");
    }
  }, [loading, organizations.length, isOnboarding, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isOnboarding || organizations.length === 0) {
    return <main className="min-h-screen bg-neutral-50">{children}</main>;
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

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
    <OrgProvider>
      <AppShell>{children}</AppShell>
    </OrgProvider>
  );
}
