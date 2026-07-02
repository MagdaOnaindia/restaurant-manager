import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

// Nota: el backoffice sirve en el puerto 3100 (el 3000 suele estar ocupado por WSL en esta máquina)
export const metadata: Metadata = {
  title: "Restaurant Manager",
  description: "Gestión de restaurantes: mesas, cartas, reservas y cobro dividido por QR.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>{children}</AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
