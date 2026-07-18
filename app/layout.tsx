import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Case Analyzer — AI-powered support case intelligence",
  description:
    "Upload Salesforce case exports and let AI classify, analyze, and surface trends. Portfolio demo — all data is synthetic.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
