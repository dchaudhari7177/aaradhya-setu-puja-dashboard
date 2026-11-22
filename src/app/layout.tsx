import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Mukta } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { AuthProvider } from "@/components/auth-provider";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], display: "swap" });
const mukta = Mukta({
  variable: "--font-mukta",
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Puja Bookings · Aaradhya Setu Admin", template: "%s · Aaradhya Setu Admin" },
  description: "Admin dashboard to search, review and progress Puja bookings for Aaradhya Setu.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#3a1e22" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Font variables sit on <html> so the @theme tokens (declared on :root) can resolve them.
    <html lang="en" className={`${bricolage.variable} ${mukta.variable} antialiased`}>
      <body className="min-h-dvh">
        <AuthProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
