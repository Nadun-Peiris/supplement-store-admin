import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Supplement Lanka",
  description: "Best Supplement Store in Sri Lanka",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
