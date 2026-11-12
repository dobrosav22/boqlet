import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/inter-tight";
import "./globals.css";
import { AuthProvider } from "@/auth";
import { ThemeProvider } from "@/components/theme-provider";
import { APP_NAME } from "@/config";

export const metadata: Metadata = { title: { default: APP_NAME, template: `%s · ${APP_NAME}` } };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>
          <ThemeProvider>
            <AuthProvider>{children}</AuthProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
