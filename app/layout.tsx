import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vansh - The family tree",
  description: "Vansh - The family tree",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
