import type { ReactNode } from "react";
import Script from "next/script";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { ToastProvider } from "@/components/ToastProvider";
import { BackendStatusBanner } from "@/components/BackendStatusBanner";

export const metadata = {
  title: "XBP Monitoring",
  description: "Monitor management dashboard for XBP Monitoring.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-default-100 text-foreground antialiased">
        <Script src="/dashboard/runtime-config.js" strategy="beforeInteractive" />
        <ToastProvider>
          <Sidebar />
          <main className="min-h-screen p-4 pt-16 sm:p-5 sm:pt-16 lg:ml-60 lg:p-6 lg:pt-6">
            <BackendStatusBanner />
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}

