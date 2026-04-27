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
    <html lang="en" className="dark">
      <body className="bg-background text-foreground min-h-screen flex">
        <ToastProvider>
          <Sidebar />
          <main className="flex-1 ml-64 p-6 overflow-auto">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}

