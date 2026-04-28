import type { ReactNode } from "react";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { ToastProvider } from "@/components/ToastProvider";

export const metadata = {
  title: "XBP Monitoring",
  description: "Monitor management dashboard for XBP Monitoring.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-default-100 text-foreground antialiased">
        <ToastProvider>
          <Sidebar />
          <main className="ml-60 min-h-screen p-5 lg:p-6">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}

