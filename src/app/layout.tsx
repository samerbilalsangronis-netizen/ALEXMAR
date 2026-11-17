import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ALEXMAR · Gestión",
  description: "Gestión privada de Autoperiquitos y Rotulados Alexmar",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("alexmar:tema");document.documentElement.dataset.tema=t==="claro"||t==="oscuro"?t:matchMedia("(prefers-color-scheme: dark)").matches?"oscuro":"claro"}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
