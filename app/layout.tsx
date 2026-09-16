import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChannelOS — Quản lý mạng lưới YouTube",
  description: "Quản lý kênh, tài khoản, hồ sơ, nghiên cứu và vận hành mạng lưới YouTube.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
