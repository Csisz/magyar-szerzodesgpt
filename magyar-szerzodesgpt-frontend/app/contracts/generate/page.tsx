"use client";

import { useState, FormEvent, useEffect } from "react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { RotatingSquare } from "react-loader-spinner";

import dynamic from "next/dynamic";

import { Edit } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


const ContractEditor = dynamic(
  () => import("@/components/ContractEditor"),
  { ssr: false }
);

type Telemetry = {
  mode: "fast" | "detailed";
  model: string;
  generation_time_sec: number;
  max_tokens: number;
};

type GenerateResponse = {
  contract_text: string;
  summary_hu: string;
  summary_en?: string | null;
  contract_html?: string;
  telemetry?: Telemetry;
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
  const [downloadFormat, setDownloadFormat] = useState<"pdf" | "docx" | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorText, setEditorText] = useState("");
  const [contractType, setContractType] = useState("megbizasi");
  const [generationMode, setGenerationMode] = useState<"fast" | "detailed">("fast");
  const [telemetry, setTelemetry] = useState<any | null>(null);
  const [contractDate, setContractDate] = useState<string>("");
  const [contractPlace, setContractPlace] = useState<string>("");



  


  // Animált, váltakozó töltés-üzenetek
  useEffect(() => {
    if (!loading) return;

    setLoadingMessageIndex(0);

    const timer = setInterval(() => {
      setLoadingMessageIndex(
        (prev) => (prev + 1) % LOADING_MESSAGES.length
      );
    }, 2000);

    return () => clearInterval(timer);
  }, [loading]);


  // Segédfüggvény: plain text → szebb HTML formázással
  function formatContractTextToHTML(text: string): string {
    if (!text) return "";

    const lines = text.split("\n");

    let html = "";
    for (let line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        html += "<p></p>"; // üres sor
        continue;
      }

      // Fejezetcímek felismerése ("1.", "1.1.", stb.)
      if (/^\d+(\.\d+)*\./.test(trimmed)) {
        html += `<h2 class="text-lg font-semibold mt-4 mb-2">${trimmed}</h2>`;
        continue;
      }

      html += `<p>${trimmed}</p>`;
    }

    return html;
  }


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
          contract_type: contractType,
          generation_mode: generationMode,
          form_data: {
            DATE: contractDate || "",
            PLACE: contractPlace || "",

            PARTIES: parties,
            SUBJECT: subject,
            PAYMENT: payment,
            DURATION: duration,
            SPECIAL_TERMS: specialTerms,
          },
        }),
      });

      if (!res.ok) {
        let msg = `Hiba a backend hívás közben: HTTP ${res.status}`;

        try {
          const errData = await res.json();
          if (errData?.detail) {
            msg = errData.detail;
          }
        } catch {
          // backend nem JSON-t küldött → ez OK
        }

        throw new Error(msg);
      }


      const data = (await res.json()) as GenerateResponse;
      setResult(data);
      setTelemetry(data.telemetry ?? null);
      setDownloadError(null);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          "Ismeretlen hiba történt a szerződés generálása során."
      );
    } finally {
      setLoading(false);
    }
  }

  // Ceruza ikon -> modal nyitás
  function openEditor() {
    if (!result) return;

    // Ha már volt szerkesztve → azt nyitjuk meg
    if (editorText) {
      setEditorOpen(true);
      return;
    }

    // Első megnyitáskor: plain text → HTML
    const htmlSeed = formatLegalTextToHtml(
      result.contract_html ?? result.contract_text
    );

    setEditorText(htmlSeed);
    setEditorOpen(true);
  }


  function formatLegalTextToHtml(text: string): string {
    if (!text) return "";

    let html = text;

    // Fejezet címek (pl. "1. Preambulum")
    html = html.replace(
      /^(\d+\.\s+[A-ZÁÉÍÓÖŐÚÜŰa-záéíóöőúüű].*)$/gm,
      "<h2>$1</h2>"
    );

    // Alcímek (pl. "1.1. Jelen szerződés...")
    html = html.replace(
      /^(\d+\.\d+\.\s+[A-ZÁÉÍÓÖŐÚÜŰa-záéíóöőúüű].*)$/gm,
      "<h3>$1</h3>"
    );

    // Felsorolások – sima hyphen
    html = html.replace(/^- (.*)$/gm, "<li>$1</li>");
    html = html.replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>");

    // Számozott bekezdések
    html = html.replace(/^(\d+\.\s.*)$/gm, "<p class='indent'>$1</p>");

    // Dupla sortörés → új paragrafus
    html = html.replace(/\n{2,}/g, "</p><p>");

    // Egy sortörés → szóköz
    // html = html.replace(/\n/g, " ");
    // Üres sor = jól látható, megtartható paragrafus
    html = html.replace(/\n{2,}/g, `<p class="empty-line">&nbsp;</p>`);


    // Wrap full content
    html = `<p>${html}</p>`;

    return html;
  }

  function closeEditor() {
    setEditorOpen(false);

    // fontos → frissíti a fő nézet tartalmát az editor HTML-lel
    setResult((prev) =>
      prev
        ? {
            ...prev,
            contract_html: editorText, // ⬅ itt adjuk vissza a szerkesztett HTML-t
          }
        : prev
    );
  }


  // Letöltés – ha textOverride meg van adva (modal), azt használja
  async function handleDownload(
    format: "pdf" | "docx",
    textOverride?: string
  ) {
    if (!result) return;

    setDownloadFormat(format);
    setDownloadError(null);

    try {
      // Exportálandó szöveg: ha a modálból jön, akkor az ott szerkesztett verzió
      const contractTextForExport = textOverride ?? result.contract_text;

      const exportText = [
        "GENERÁLT SZERZŐDÉS",
        "",
        contractTextForExport,
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
          brand_subtitle:
            "AI-alapú szerződésgenerálás (általános tájékoztatás)",
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

      const safeTitle = ((type || "szerzodes") + "_generalas")
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
      {/* Teljes képernyős loading overlay */}
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
                {/* <div className="space-y-1">                  
                  <Label htmlFor="type">Szerződés típusa</Label>
                  <Input
                    id="type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    placeholder="pl. Megbízási szerződés, Bérleti szerződés, Adásvételi szerződés"
                  />
                </div> */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* SZERZŐDÉS TÍPUS */}
                  <div>
                    <label className="text-sm text-slate-300 mb-1 block">
                      Szerződés típusa
                    </label>
                    <Select value={contractType} onValueChange={setContractType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Válassz szerződés típust" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="megbizasi">Megbízási szerződés</SelectItem>
                        <SelectItem value="nda">Titoktartási megállapodás (NDA)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* GENERÁLÁSI MÓD */}
                  <div>
                    <label className="text-sm text-slate-300 mb-1 block">
                      Generálás részletessége
                    </label>
                    <Select
                      value={generationMode}
                      onValueChange={(v) => setGenerationMode(v as "fast" | "detailed")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fast">⚡ Gyors (vázlatos)</SelectItem>
                        <SelectItem value="detailed">🧠 Alapos (részletes)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

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
                    placeholder="pl. titoktartás, versenytilalom, szellemi alkotások sorsa, kötbér, stb."
                    rows={3}
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-400">
                    ❌ {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3"
                  disabled={loading}
                >
                  {loading
                    ? "Generálás folyamatban..."
                    : "Szerződés generálása"}
                </Button>

                {process.env.NODE_ENV === "development" && telemetry && (
                  <div className="mt-2 text-xs text-slate-400">
                    ⚡ {telemetry.mode.toUpperCase()} ·
                    {telemetry.model} ·
                    {telemetry.generation_time_sec}s ·
                    max_tokens={telemetry.max_tokens}
                  </div>
                )}

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

              {loading && (
                <p className="text-sm text-slate-300">
                  ⏳ A szerződés generálása folyamatban...
                </p>
              )}

              {result && (
                <>
                  <section className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-lg">
                        Szerződés szövege
                      </h2>

                      <button
                        type="button"
                        onClick={openEditor}
                        className="rounded-full bg-slate-800/80 p-2 text-slate-200 hover:bg-slate-700 hover:text-white transition"
                      >
                        <Edit className="w-4 h-4" />
                        <span className="sr-only">Szerződés szerkesztése</span>
                      </button>
                    </div>

                    {/* <div className="bg-slate-900/70 rounded-md p-3 max-h-[320px] overflow-auto text-sm whitespace-pre-wrap"
                    >
                      {result.contract_text}
                    </div> */}
                    <div
                      className="bg-slate-900/70 rounded-md p-3 max-h-[320px] overflow-auto text-sm prose prose-invert"
                      dangerouslySetInnerHTML={{
                        __html: editorText || formatContractTextToHTML(result.contract_text)
                      }}


                    />



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

      {/* Szerkesztő modal – csak akkor, ha van eredmény */}
      {result && (
        <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
          <DialogContent className="
              max-w-4xl
              max-h-[90vh]
              flex flex-col
              bg-slate-900
              border border-slate-700
              text-slate-50
            ">

            <DialogHeader>
              <DialogTitle>Generált szerződés szerkesztése</DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-hidden flex flex-col mt-4">

              {/* SCROLLOZHATÓ EDITOR */}
              <div className="flex-1 overflow-auto pr-2">
                <ContractEditor
                  value={editorText}
                  onChange={(html) => setEditorText(html)}
                />
              </div>

              {/* FIX LÁBLÉC */}
              <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 pt-3 mt-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => handleDownload("pdf", editorText)}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
                    >
                      PDF letöltése
                    </Button>

                    <Button
                      type="button"
                      onClick={() => handleDownload("docx", editorText)}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
                    >
                      Word (DOCX) letöltése
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    className="bg-slate-700 text-slate-100 hover:bg-slate-600"
                    onClick={() => setEditorOpen(false)}
                  >
                    Bezárás
                  </Button>

                </div>

                {downloadError && (
                  <p className="text-xs text-red-400 mt-2">
                    ❌ {downloadError}
                  </p>
                )}
              </div>

            </div>

          </DialogContent>
        </Dialog>
      )}

    </main>
  );
}

type LoadingOverlayProps = {
  visible: boolean;
  message: string;
  title: string;
};

function LoadingOverlay({
  visible,
  message,
  title,
}: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-slate-900 px-8 py-6 shadow-xl border border-slate-700">
        <RotatingSquare
          height="60"
          width="60"
          ariaLabel="square-loading"
          strokeWidth="4"
          visible={true}
        />
        <div className="text-center space-y-1">
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
