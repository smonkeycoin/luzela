import type { Metadata } from "next";
import type { Viewport } from "next";
import type { ReactNode } from "react";
import { Montserrat } from "next/font/google";
import { AttributionCapture } from "@/components/attribution-capture";
import { MetaPixel } from "@/components/meta-pixel";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://luzela.mx"),
  title: "Luzela | Protección Solar Mineral SPF 50+",
  description:
    "Protección solar mineral SPF 50+ hecha en México. Ligera, 100% mineral y pensada para acompañarte de la ciudad al mar.",
  applicationName: "Luzela",
  appleWebApp: {
    title: "Luzela",
  },
  alternates: {
    canonical: "https://luzela.mx",
  },
  openGraph: {
    title: "Luzela | Protección Solar Mineral SPF 50+",
    description:
      "Más Luzela. Más días bajo el sol. Protección solar mineral SPF 50+ hecha en México.",
    url: "https://luzela.mx",
    siteName: "Luzela México",
    type: "website",
    locale: "es_MX",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Luzela Protección solar mineral SPF 50+",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Luzela | Protección Solar Mineral SPF 50+",
    description:
      "Más Luzela. Más días bajo el sol. Protección solar mineral SPF 50+ hecha en México.",
    images: ["/twitter-image"],
  },
  icons: {
    icon: [{ url: "/icon", type: "image/png" }],
    apple: [{ url: "/apple-icon", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#147b75",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-MX" className={`${montserrat.variable} h-full antialiased`}>
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
        <AttributionCapture />
        <MetaPixel />
        {children}
      </body>
    </html>
  );
}
