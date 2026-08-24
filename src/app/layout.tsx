import type { Metadata } from "next";
import "./globals.css";
import "./municipal-theme.css";

export const metadata: Metadata = {
  title: "Low-Code Builder & Control Studio",
  description: "Dynamic Web Application Builder & DesignMode Studio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
