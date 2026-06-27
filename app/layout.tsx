import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RTO Leads — D2C Lead CRM",
  description: "Scrape, score, and track Indian D2C founder leads to reduce their RTO.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
