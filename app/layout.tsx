import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChannelOS — YouTube Network Manager",
  description: "Manage channels, accounts, profiles, research and operations across your YouTube network.",
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
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
