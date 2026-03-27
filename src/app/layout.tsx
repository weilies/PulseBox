import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ErrorListener } from "@/components/error-listener";
import { ThemeProvider } from "@/components/theme-provider";
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
 title: "PulseBox",
 description: "Modern HR platform by Next Novas",
};

export default function RootLayout({
 children,
}: Readonly<{
 children: React.ReactNode;
}>) {
 return (
 <html lang="en" suppressHydrationWarning>
 <body
 className={`${geistSans.variable} ${geistMono.variable} antialiased`}
 >
 <ThemeProvider>
 {children}
 <Toaster />
 <ErrorListener />
 </ThemeProvider>
 </body>
 </html>
 );
}