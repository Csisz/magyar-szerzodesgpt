"use client";

import { useState, FormEvent, useEffect } from "react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";


import { RotatingSquare } from "react-loader-spinner";

type ReviewIssue = {
  clause_excerpt: string;
  issue: string;
  risk_level: "alacsony" | "közepes" | "magas";
  disadvantaged_party: string | null;
  suggestion: string;
};

type ReviewResponse = {
  summary_hu: string;
  issues: ReviewIssue[];
  overall_risk: "alacsony" | "közepes" | "magas";
  notes?: string | null;
};

// VÁLTOZÓ REVIEW-ÜZENETEK
const LOADING_REVIEW_MESSAGES = [
  "Szerződés szakaszainak beolvasása…",
  "Kockázatos / egyoldalú klauzulák keresése…",
  "Jogkövetkezmények és kötelezettségek elemzése…",
  "Javasolt módosítások generálása…",
  "Összefoglaló és kockázati szint összerakása…",
];

export default function ContractReviewPage() {
  const [contractText, setContractText] = useState("");
  const [contractType, setContractType] = useState("");
  const [partyRole, setPartyRole] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResponse | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [downloadFormat, setDownloadFormat] = useState<"pdf" | "docx" | null>(
    null
  );
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Animált, váltakozó review-üzenetek
  useEffect(() => {
    if (!loading) return;

    setLoadingMessageIndex(0);

    const timer = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % LOADING_REVIEW_MESSAGES.length);
    }, 2000);

    return () => clearInterval(timer);
  }, [loading]);

  async function handleReview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setDownloadError(null);

    try {
      const res = await fetch("http://127.0.0.1:8000/contracts/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contract_text: contractText,
          contract_type: contractType || null,
          party_role: partyRole || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const msg =
          errData?.detail ||
          `Hiba történt a review során (HTTP ${res.status}).`;
        throw new Error(msg);
      }

      const data = (await res.json()) as ReviewResponse;
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Ismeretlen hiba történt a review során.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://127.0.0.1:8000/contracts/extract-text", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const msg =
          errData?.detail ||
          `Nem sikerült a fájlból szöveget kinyerni (HTTP ${res.status}).`;
        throw new Error(msg);
      }

      const data = await res.json();
      setContractText(data.text || "");
    } catch (err: any) {
      console.error(err);
      setUploadError(
        err?.message || "Nem sikerült a fájlból szöveget kinyerni."
      );
    } finally {
      setUploading(false);
    }
  }

  function buildReviewReportText(
    res: ReviewResponse,
    originalText: string
  ): string {
    const lines: string[] = [];

    lines.push("AI szerződés-review riport");
    lines.push("");
    if (contractType) {
      lines.push(`Szerződés típusa: ${contractType}`);
    }
    if (partyRole) {
      lines.push(`Te szereped: ${partyRole}`);
    }
    lines.push(`Össz-kockázati szint: ${res.overall_risk.toUpperCase()}`);
    lines.push("");

    lines.push("1) Összefoglaló (közérthetően):");
    lines.push(res.summary_hu);
    lines.push("");
    lines.push("2) Kockázatos / problémás pontok:");
    lines.push("");

    if (!res.issues || res.issues.length === 0) {
      lines.push("- A rendszer nem talált konkrét, kiemelten kockázatos pontot.");
    } else {
      res.issues.forEach((issue, idx) => {
        lines.push(`#${idx + 1} – Kockázati szint: ${issue.risk_level}`);
        if (issue.disadvantaged_party) {
          lines.push(`Érintett fél: ${issue.disadvantaged_party}`);
        }
        lines.push("");
        lines.push("Részlet / klauzula:");
        lines.push(issue.clause_excerpt);
        lines.push("");
        lines.push("Mi a probléma:");
        lines.push(issue.issue);
        lines.push("");
        lines.push("Javasolt módosítás:");
        lines.push(issue.suggestion);
        lines.push("");
        lines.push("-----------------------------------------------------");
        lines.push("");
      });
    }

    lines.push("");
    lines.push("3) Eredeti szerződésszöveg:");
    lines.push(originalText);

    return lines.join("\n");
  }

async function handleDownload(format: "pdf" | "docx") {
  if (!result) return;

  setDownloadFormat(format);
  setDownloadError(null);

  try {
    // 1) Szöveg összerakása a review eredményből + eredeti szerződésből
    const reportText = buildReviewReportText(result, contractText);

    // 2) Payload az export API-nak
    const payload = {
      template_name: "raw",
      format,
      template_vars: {
        contract_text: reportText,
      },
      document_title:
        (contractType || "Szerződés") + " - AI review riport",
      document_date: new Date().toISOString().slice(0, 10),
      document_number: "",
      brand_name: "Magyar SzerződésGPT",
      brand_subtitle:
        "AI-alapú szerződésértékelés (általános tájékoztatás, nem jogi tanácsadás)",
      footer_text:
        "Ez a dokumentum automatikusan generált, általános tájékoztatásnak minősül, nem helyettesíti a jogi tanácsadást.",
    };

    const res = await fetch("http://127.0.0.1:8000/contracts/export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      const msg =
        errData?.detail ||
        `Nem sikerült a review riport exportálása (HTTP ${res.status}).`;
      throw new Error(msg);
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const ext = format === "pdf" ? "pdf" : "docx";
    const safeTitle = (
      (contractType || "szerzodes_review") + "_review"
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
      err?.message || "Nem sikerült a review riport exportálása."
    );
  } finally {
    setDownloadFormat(null);
  }
}


  function riskBadgeColor(risk: ReviewIssue["risk_level"]) {
    switch (risk) {
      case "magas":
        return "bg-red-500/80 text-white";
      case "közepes":
        return "bg-amber-500/80 text-slate-900";
      case "alacsony":
      default:
        return "bg-emerald-500/80 text-slate-900";
    }
  }

  return (
    <main className="min-h-screen bg-slate-900 text-slate-50 px-4 py-8">
      {/* TELJES KÉPERNYŐS LOADING OVERLAY REVIEWHEZ */}
      <LoadingOverlay
        visible={loading}
        title="A szerződés elemzése folyamatban…"
        message={LOADING_REVIEW_MESSAGES[loadingMessageIndex]}
        />


      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Szerződés review (AI értékelés)
          </h1>
          <p className="text-sm text-slate-300 max-w-3xl">
            Illeszd be vagy töltsd fel a szerződés szövegét. Az AI rövid,
            közérthető összefoglalót készít, és kiemeli a kockázatos / egyoldalú
            pontokat, javasolt módosításokkal.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)]">
          {/* BAL: űrlap */}
          <Card className="bg-slate-800/90 border-slate-700">
            <CardHeader>
              <CardTitle>Szerződés megadása</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleReview}>
                <div className="space-y-1">
                  <Label htmlFor="contractType">Szerződés típusa</Label>
                  <Input
                    id="contractType"
                    value={contractType}
                    onChange={(e) => setContractType(e.target.value)}
                    placeholder="pl. Megbízási szerződés, Bérleti szerződés"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="partyRole">
                    Te melyik fél vagy a szerződésben? (nem kötelező)
                  </Label>
                  <Input
                    id="partyRole"
                    value={partyRole}
                    onChange={(e) => setPartyRole(e.target.value)}
                    placeholder='pl. "megbízó", "bérlő", "szállító"'
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="file">Szerződés feltöltése (opcionális)</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={handleFileUpload}
                  />
                  <p className="text-xs text-slate-400">
                    PDF, Word (DOC/DOCX) vagy TXT fájlt tölthetsz fel. A rendszer
                    kinyeri belőle a szöveget.
                  </p>
                  {uploading && (
                    <p className="text-xs text-slate-300">
                      ⏳ Szöveg kinyerése folyamatban...
                    </p>
                  )}
                  {uploadError && (
                    <p className="text-xs text-red-400">❌ {uploadError}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="contractText">
                    Szerződés szövege (kötelező)
                  </Label>
                  <Textarea
                    id="contractText"
                    value={contractText}
                    onChange={(e) => setContractText(e.target.value)}
                    placeholder="Illeszd ide a teljes szerződés szövegét..."
                    rows={14}
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-400">
                    ❌ Hiba: {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
                  disabled={loading || !contractText.trim()}
                >
                  {loading ? "Review folyamatban..." : "AI review indítása"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* JOBB: eredmény + export */}
          <Card className="bg-slate-800/90 border-slate-700">
            <CardHeader>
              <CardTitle>AI értékelés eredménye</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!result && !loading && (
                <p className="text-sm text-slate-400">
                  Itt fog megjelenni a szerződés összefoglalója és a kockázatos
                  pontok listája, miután lefuttattad a review-t.
                </p>
              )}

              {loading && (
                <p className="text-sm text-slate-300">
                  ⏳ A szerződés elemzése folyamatban...
                </p>
              )}

              {result && (
                <>
                  <section className="space-y-2">
                    <h2 className="font-semibold text-lg">Összefoglaló</h2>
                    <div className="bg-slate-900/70 rounded-md p-3 max-h-48 overflow-auto text-sm whitespace-pre-wrap">
                      {result.summary_hu}
                    </div>
                    <p className="text-xs text-slate-400">
                      Össz-kockázati szint:{" "}
                      <span className="font-semibold">
                        {result.overall_risk.toUpperCase()}
                      </span>
                    </p>
                    {result.notes && (
                      <p className="text-xs text-slate-400 mt-1">
                        Megjegyzés: {result.notes}
                      </p>
                    )}
                  </section>

                  <section className="space-y-2">
                    <h2 className="font-semibold text-lg">
                      Kockázatos / problémás pontok
                    </h2>
                    {(!result.issues || result.issues.length === 0) && (
                      <p className="text-sm text-slate-300">
                        Az AI nem talált kifejezetten kockázatos pontot, vagy a
                        kockázat alacsony.
                      </p>
                    )}
                    <div className="space-y-3 max-h-80 overflow-auto pr-1">
                      {result.issues?.map((issue, idx) => (
                        <div
                          key={idx}
                          className="rounded-md border border-slate-700 bg-slate-900/70 p-3 text-sm space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">
                              #{idx + 1}. Kockázati szint:
                            </span>
                            <span
                              className={
                                "px-2 py-0.5 rounded-full text-xs font-semibold " +
                                riskBadgeColor(issue.risk_level)
                              }
                            >
                              {issue.risk_level.toUpperCase()}
                            </span>
                          </div>
                          {issue.disadvantaged_party && (
                            <p className="text-xs text-slate-300">
                              Érintett fél:{" "}
                              <span className="font-semibold">
                                {issue.disadvantaged_party}
                              </span>
                            </p>
                          )}
                          <div className="mt-1">
                            <p className="font-semibold text-xs text-slate-400">
                              Érintett klauzula / részlet:
                            </p>
                            <p className="whitespace-pre-wrap">
                              {issue.clause_excerpt}
                            </p>
                          </div>
                          <div className="mt-1">
                            <p className="font-semibold text-xs text-slate-400">
                              Mi a probléma:
                            </p>
                            <p className="whitespace-pre-wrap">
                              {issue.issue}
                            </p>
                          </div>
                          <div className="mt-1">
                            <p className="font-semibold text-xs text-slate-400">
                              Javasolt módosítás:
                            </p>
                            <p className="whitespace-pre-wrap">
                              {issue.suggestion}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-2">
                    <h2 className="font-semibold text-lg">
                      Review riport letöltése
                    </h2>
                    <p className="text-xs text-slate-400">
                      A riport tartalmazza az összefoglalót, a kockázatos pontok
                      listáját, a javaslatokat és az eredeti szerződésszöveget.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload("pdf")}
                        disabled={downloadFormat !== null}
                      >
                        {downloadFormat === "pdf"
                          ? "PDF letöltése..."
                          : "Review riport PDF-ben"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload("docx")}
                        disabled={downloadFormat !== null}
                      >
                        {downloadFormat === "docx"
                          ? "Word (DOCX) letöltése..."
                          : "Review riport DOCX-ben"}
                      </Button>
                      {downloadError && (
                        <p className="text-xs text-red-400">
                          ❌ {downloadError}
                        </p>
                      )}
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
        {/* <div className="flex flex-col items-center gap-1 text-center"> */}
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

