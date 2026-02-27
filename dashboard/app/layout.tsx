import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "XBP Monitoring Dashboard",
  description: "Trigger probes/stories, edit config, and restart the monitoring server."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
