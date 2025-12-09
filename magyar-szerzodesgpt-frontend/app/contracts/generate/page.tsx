"use client";

import { useState, FormEvent, useEffect } from "react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import { RotatingSquare } from "react-loader-spinner";


type GenerateResponse = {
  contract_text: string;
  summary_hu: string;
  summary_en?: string | null;
};

const LOADING_MESSAGES = [
  "Alapadatok elemzése…",
  "Szerződés szerkezetének összeállítása…",
  "Jogi szöveg generálása és finomhangolása…",
  "Közérthető összefoglaló készítése…",
  "Kockázati pontok azonosítása…",
];


export default function ContractGeneratePage() {
  const [type, setType] = useState("Megbízási szerződés");
  const [parties, setParties] = useState("");
  const [subject, setSubject] = useState("");
  const [payment, setPayment] = useState("");
  const [duration, setDuration] = useState("");
  const [specialTerms, setSpecialTerms] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  const [downloadFormat, setDownloadFormat] = useState<"pdf" | "docx" | null>(
    null
  );
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // váltakozó "mit csinál éppen" szövegek
  useEffect(() => {
    if (!loading) return;

    setLoadingMessageIndex(0);

    const timer = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);

    return () => clearInterval(timer);
  }, [loading]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setDownloadError(null);

    try {
      const res = await fetch("http://127.0.0.1:8000/contracts/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          parties,
          subject,
          payment,
          duration,
          special_terms: specialTerms || null,
        }),
      });

      if (!res.ok) {
        throw new Error(`Hiba a backend hívás közben: ${res.status}`);
      }

      const data = (await res.json()) as GenerateResponse;
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Ismeretlen hiba történt a generálás során.");
    } finally {
      setLoading(false);
    }
  }

async function handleDownload(format: "pdf" | "docx") {
  if (!result) return;

  setDownloadFormat(format);
  setDownloadError(null);

  try {
    
    // Exportálandó szöveg – itt NEM review riportot csinálunk,
    // hanem a generált szerződés + összefoglaló kerül bele.
    const exportText = [
      "GENERÁLT SZERZŐDÉS",
      "",
      result.contract_text,
      "",
      "ÖSSZEFOGLALÓ (AI által generált, közérthető magyarázat)",
      "",
      result.summary_hu || "",
    ].join("\n");

    const payload = {
      template_name: "raw",
      format,
      template_vars: {
        contract_text: exportText,
      },
      meta: {
        document_title: `${type || "Szerződés"} - AI generált szerződés`,
        document_date: new Date().toISOString().slice(0, 10),
        document_number: "",
        brand_name: "Magyar SzerződésGPT",
        brand_subtitle: "AI-alapú szerződésgenerálás (általános tájékoztatás)",
        footer_text:
          "Ez a dokumentum automatikusan generált, általános tájékoztatásnak minősül, nem helyettesíti a jogi tanácsadást.",
      },
    };

    const res = await fetch("http://127.0.0.1:8000/contracts/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      const msg =
        errData?.detail ||
        `Nem sikerült az export (HTTP ${res.status}).`;
      throw new Error(msg);
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const ext = format === "pdf" ? "pdf" : "docx";

    const safeTitle = (
      (type || "szerzodes") + "_generalas"
    )
      .toLowerCase()
      .replace(/[^a-z0-9\-]+/gi, "_");

    link.href = url;
    link.download = `${safeTitle}.${ext}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (err: any) {
    console.error(err);
    setDownloadError(
      err?.message || "Nem sikerült a dokumentum letöltése."
    );
  } finally {
    setDownloadFormat(null);
  }
}


  return (
    <main className="min-h-screen bg-slate-900 text-slate-50 px-4 py-8">
      {/* LOADING OVERLAY – a teljes képernyőn, amikor generál */}
    <LoadingOverlay
        visible={loading}
        title="A szerződés generálása folyamatban…"
        message={LOADING_MESSAGES[loadingMessageIndex]}
    />


      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        {/* Fejléc */}
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Szerződés generálása
          </h1>
          <p className="text-sm text-slate-300 max-w-2xl">
            Add meg az alapadatokat, és a Magyar SzerződésGPT elkészít egy
            részletes, magyar nyelvű szerződéstervezetet, valamint egy
            közérthető összefoglalót arról, hogy mit jelent a gyakorlatban.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)]">
          {/* BAL OLDAL: űrlap */}
          <Card className="bg-slate-800/90 border-slate-700">
            <CardHeader>
              <CardTitle>Alapadatok megadása</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1">
                  <Label htmlFor="type">Szerződés típusa</Label>
                  <Input
                    id="type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    placeholder="pl. Megbízási szerződés, Bérleti szerződés, Adásvételi szerződés"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="parties">Felek rövid leírása</Label>
                  <Textarea
                    id="parties"
                    value={parties}
                    onChange={(e) => setParties(e.target.value)}
                    placeholder="pl. Megbízó: Teszt Kft. (cégadatokkal), Megbízott: Kiss János e.v. (cím, adószám)"
                    rows={3}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="subject">Szerződés tárgya</Label>
                  <Textarea
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="pl. online marketing tanácsadás, Facebook kampánykezelés, stb."
                    rows={3}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="payment">Díjazás és fizetés</Label>
                  <Textarea
                    id="payment"
                    value={payment}
                    onChange={(e) => setPayment(e.target.value)}
                    placeholder="pl. havi 200 000 Ft + ÁFA, 8 napos fizetési határidő, banki átutalás"
                    rows={3}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="duration">Időtartam és felmondás</Label>
                  <Input
                    id="duration"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="pl. határozatlan idő, 30 napos felmondási idővel"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="specialTerms">Speciális kikötések</Label>
                  <Textarea
                    id="specialTerms"
                    value={specialTerms}
                    onChange={(e) => setSpecialTerms(e.target.value)}
                    placeholder="pl. titoktartás, versenytilalom, szellemi tulajdon, kötbér"
                    rows={4}
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-400">
                    ❌ Hiba történt: {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
                  disabled={loading}
                >
                  {loading ? "Generálás folyamatban..." : "Szerződés generálása"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* JOBB OLDAL: eredmény */}
          <Card className="bg-slate-800/90 border-slate-700">
            <CardHeader>
              <CardTitle>Generált szerződés és összefoglaló</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!result && !loading && (
                <p className="text-sm text-slate-400">
                  Itt fog megjelenni a generált szerződés és a laikus
                  összefoglaló, miután elküldted az űrlapot.
                </p>
              )}

              {/* ha szeretnéd, ezt a sima szöveget akár el is hagyhatod,
                  mert úgyis ott az overlay */}
              {loading && (
                <p className="text-sm text-slate-300">
                  ⏳ A szerződés generálása folyamatban...
                </p>
              )}

              {result && (
                <>
                  <section className="space-y-2">
                    <h2 className="font-semibold text-lg">
                      Szerződés szövege
                    </h2>
                    <div className="bg-slate-900/70 rounded-md p-3 max-h-[320px] overflow-auto text-sm whitespace-pre-wrap">
                      {result.contract_text}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload("pdf")}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold border-none"
                        disabled={downloadFormat !== null}
                      >
                        {downloadFormat === "pdf"
                          ? "PDF letöltése..."
                          : "PDF letöltése"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload("docx")}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold border-none"
                        disabled={downloadFormat !== null}
                      >
                        {downloadFormat === "docx"
                          ? "Word (DOCX) letöltése..."
                          : "Word (DOCX) letöltése"}
                      </Button>
                      {downloadError && (
                        <p className="text-xs text-red-400">
                          ❌ {downloadError}
                        </p>
                      )}
                    </div>
                  </section>

                  <section className="space-y-2">
                    <h2 className="font-semibold text-lg">
                      Összefoglaló (közérthető)
                    </h2>
                    <div className="bg-slate-900/70 rounded-md p-3 max-h-[220px] overflow-auto text-sm whitespace-pre-wrap">
                      {result.summary_hu}
                    </div>
                  </section>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

type LoadingOverlayProps = {
  visible: boolean;
  message: string;
};

function LoadingOverlay({ visible, message, title }: { visible: boolean; message: string; title: string }) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-slate-900 px-8 py-6 shadow-xl border border-slate-700">

        {/* MODERN ROTATING SQUARE LOADER */}
        <RotatingSquare
          height="90"
          width="90"
          color="#10b981"          // emerald-500
          ariaLabel="rotating-square-loading"
          visible={true}
        />

        {/* SZÖVEGEK (ez marad ugyanúgy!) */}
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-slate-900 px-8 py-6 shadow-xl border border-slate-700 w-[360px] h-[140px]">            
        <p className="text-sm font-medium text-slate-100">
            {title}
        </p>
        <p className="text-xs text-slate-400 min-h-[2rem] transition-opacity duration-300">
            {message}
        </p>
        </div>

      </div>
    </div>
  );
}

