import "./globals.css";
import type { Metadata } from "next";
import { MainNav } from "@/components/main-nav";

export const metadata: Metadata = {
  title: "Magyar SzerződésGPT",
  description: "AI-alapú magyar szerződés generálás és elemzés",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="hu">
      <body className="bg-slate-900 text-slate-50">
        <MainNav />
        {/* Az oldalak saját layoutja – már mindegyik maga tartalmazza a <main>-t, paddinget, stb. */}
        {children}
      </body>
    </html>
  );
}
