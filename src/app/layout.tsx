import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alberius Operations Hub",
  description: "Alberius Operations Hub — central access point for dashboards, files & records, CRA accounting, and company management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className={`${inter.className} min-h-full bg-gray-950 text-gray-100`}>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
