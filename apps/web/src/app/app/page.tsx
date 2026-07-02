"use client";

import { useAuth } from "@/components/auth-provider";
import { Card } from "@/components/ui";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Hola, {user?.name} 👋</h1>
      <Card>
        <p className="text-neutral-600">
          Bienvenida a tu panel. En el siguiente paso podrás crear tu organización y tu primer
          restaurante.
        </p>
      </Card>
    </div>
  );
}
