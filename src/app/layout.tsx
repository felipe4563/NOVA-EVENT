import type { Metadata, Viewport } from "next";
import { Cinzel, Montserrat } from "next/font/google";
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
};

export const viewport: Viewport = {
  themeColor: "#7a2944",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${cinzel.variable} ${montserrat.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
