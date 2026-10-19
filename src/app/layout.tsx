import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Rifa do Casamento | Nicolly & João",
  description: "Participe da rifa em prol do nosso casamento e concorra a 5 prêmios incríveis."
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
