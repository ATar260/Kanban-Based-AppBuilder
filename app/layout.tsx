import type { Metadata } from "next";
import { Inter, Roboto_Mono, Plus_Jakarta_Sans } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ClerkProvider } from "@clerk/nextjs";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
});

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

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["200", "300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Paynto A.I.",
  description: "Re-imagine any website in seconds with AI-powered website builder.",
  icons: {
    icon: "/paynto-icon.svg",
    apple: "/paynto-logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} ${robotoMono.variable} ${plusJakarta.variable} font-sans`}
      >
        <ClerkProvider>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </ClerkProvider>
      </body>
    </html>
  );
}
