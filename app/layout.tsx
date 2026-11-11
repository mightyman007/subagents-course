import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Subagents Mastery",
  description:
    "An interactive self-study course on AI coding subagents — OpenCode V2 and Claude Code.",
};

/** The three course sections, in study order. */
const NAV_LINKS = [
  { href: "/learn", label: "learn" },
  { href: "/exam", label: "exam" },
  { href: "/downloads", label: "downloads" },
] as const;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="border-b border-line">
          <nav className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-3">
            <Link
              href="/"
              className="font-mono text-xs text-foreground transition-colors hover:text-accent"
            >
              ~/subagents-mastery
            </Link>
            <div className="flex gap-5 font-mono text-xs">
              {NAV_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-muted transition-colors hover:text-accent"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
