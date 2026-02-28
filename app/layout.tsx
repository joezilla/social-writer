import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Social Writer",
  description: "LinkedIn Content Intelligence Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground`}
      >
        <nav className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-sm">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 flex items-center h-14 gap-8">
            <Link
              href="/"
              className="font-semibold text-base tracking-tight focus-ring rounded-sm"
            >
              Social Writer
            </Link>
            <div className="flex gap-1 text-sm" role="navigation" aria-label="Main">
              <Link
                href="/"
                className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-ring"
              >
                Pipeline
              </Link>
              <Link
                href="/analytics"
                className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-ring"
              >
                Analytics
              </Link>
              <Link
                href="/settings"
                className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-ring"
              >
                Settings
              </Link>
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
