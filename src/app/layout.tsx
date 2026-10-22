import type { Metadata, Viewport } from "next";
import { Cinzel, Montserrat } from "next/font/google";
import { TEMA_SCRIPT } from "@/lib/tema";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Nova Event", template: "%s · Nova Event" },
  description: "Tú sueñas, nosotros lo hacemos realidad.",
  applicationName: "Nova Event",
  appleWebApp: { capable: true, title: "Nova Event", statusBarStyle: "default" },
  // Íconos de la marca: los que se suban en Administración → Empresa, o los originales.
  icons: { icon: "/marca/icono-192.png", apple: "/marca/apple-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#7a2944" },
    { media: "(prefers-color-scheme: dark)", color: "#272c30" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme lo corrige el script antes de pintar; por eso se suprime el aviso de hidratación.
    <html
      lang="es"
      data-theme="light"
      suppressHydrationWarning
      className={`${cinzel.variable} ${montserrat.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
