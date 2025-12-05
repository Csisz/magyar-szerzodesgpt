"use client";

import { useState } from "react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type ApplyResult = {
  updated_contract_text: string;
  change_summary: string;
};

export default function ApplySuggestionsPage() {
  const [original, setOriginal] = useState("");
  const [issuesJson, setIssuesJson] = useState("");
  const [result, setResult] = useState<ApplyResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [downloadFormat, setDownloadFormat] = useState<"pdf" | "docx" | null>(
    null
  );
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function apply() {
    setLoading(true);
    setError(null);
    setResult(null);
    setDownloadError(null);

    try {
      if (!original.trim()) {
        throw new Error("Add meg az eredeti szerződésszöveget.");
      }
      if (!issuesJson.trim()) {
        throw new Error(
          "Add meg a kiválasztott javaslatokat JSON formában (issues listából)."
        );
      }

      let issues: any;
      try {
        issues = JSON.parse(issuesJson);
      } catch {
        throw new Error(
          "A javaslatok mező nem érvényes JSON. Másold be pontosan az AI által adott issues tömböt."
        );
      }

      const res = await fetch(
        "http://127.0.0.1:8000/contracts/apply-suggestions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            original_contract: original,
            issues_to_apply: issues,
          }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const msg =
          errData?.detail ||
          `Hiba történt a javaslatok alkalmazása során (HTTP ${res.status}).`;
        throw new Error(msg);
      }

      const data = (await res.json()) as ApplyResult;
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message || "Ismeretlen hiba történt a javaslatok alkalmazásakor."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(format: "pdf" | "docx") {
    if (!result) return;

    setDownloadFormat(format);
    setDownloadError(null);

    try {
      const payload = {
        template_name: "raw",
        format,
        template_vars: {
          contract_text: result.updated_contract_text,
        },
        document_title: "Módosított szerződés (AI javaslatok alapján)",
        document_date: new Date().toISOString().slice(0, 10),
        document_number: "",
        brand_name: "Magyar SzerződésGPT",
        brand_subtitle:
          "AI-alapú szerződésmódosítás (általános tájékoztatás, nem jogi tanácsadás)",
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
          `Nem sikerült a módosított szerződés exportálása (HTTP ${res.status}).`;
        throw new Error(msg);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const ext = format === "pdf" ? "pdf" : "docx";
      const safeTitle = "modositott_szerzodes_ai"
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
        err?.message || "Nem sikerült a módosított szerződés exportálása."
      );
    } finally {
      setDownloadFormat(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-900 text-slate-50 px-4 py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            AI javaslatok alkalmazása
          </h1>
          <p className="text-sm text-slate-300 max-w-3xl">
            Illeszd be az eredeti szerződésszöveget és a Review oldalról kapott
            issues listát (JSON formátumban). Az AI elkészíti a módosított
            szerződést és egy rövid összefoglalót a változásokról.
          </p>
        </header>

        <Card className="bg-slate-800/90 border-slate-700">
          <CardHeader>
            <CardTitle>Bemenetek</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="original">Eredeti szerződés szövege</Label>
              <Textarea
                id="original"
                value={original}
                onChange={(e) => setOriginal(e.target.value)}
                rows={12}
                placeholder="Illeszd ide az eredeti szerződés teljes szövegét..."
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="issues">
                Kiválasztott javaslatok JSON formában
              </Label>
              <Textarea
                id="issues"
                value={issuesJson}
                onChange={(e) => setIssuesJson(e.target.value)}
                rows={10}
                placeholder='Illeszd ide a ContractReviewResponse["issues"] részét vagy annak egy részhalmazát JSON-ben...'
              />
              <p className="text-xs text-slate-400">
                Tipp: ha az összes javaslatot alkalmazni szeretnéd, másold be
                teljes egészében az AI által adott <code>issues</code> tömböt.
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-400">❌ Hiba: {error}</p>
            )}

            <Button
              type="button"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
              onClick={apply}
              disabled={loading}
            >
              {loading
                ? "Javaslatok alkalmazása..."
                : "AI javaslatok alkalmazása a szerződésre"}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/90 border-slate-700">
          <CardHeader>
            <CardTitle>Eredmény és letöltés</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!result && !loading && (
              <p className="text-sm text-slate-400">
                Itt fog megjelenni a változtatások összefoglalója és a
                módosított szerződés, miután lefuttattad a javaslatok
                alkalmazását.
              </p>
            )}

            {loading && (
              <p className="text-sm text-slate-300">
                ⏳ A módosított szerződés előállítása folyamatban...
              </p>
            )}

            {result && (
              <>
                <section className="space-y-2">
                  <h2 className="font-semibold text-lg">
                    Változtatások összefoglalója
                  </h2>
                  <div className="bg-slate-900/70 rounded-md p-3 max-h-48 overflow-auto text-sm whitespace-pre-wrap">
                    {result.change_summary}
                  </div>
                </section>

                <section className="space-y-2">
                  <h2 className="font-semibold text-lg">Módosított szerződés</h2>
                  <div className="bg-slate-900/70 rounded-md p-3 max-h-[360px] overflow-auto text-sm whitespace-pre-wrap">
                    {result.updated_contract_text}
                  </div>
                </section>

                <section className="space-y-2">
                  <h2 className="font-semibold text-lg">
                    Letöltés (PDF / Word)
                  </h2>
                  <p className="text-xs text-slate-400">
                    A letöltött dokumentum a módosított szerződés teljes szövegét
                    tartalmazza, az AI javaslatainak beépítésével.
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
                        : "PDF letöltése"}
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
                        : "Word (DOCX) letöltése"}
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
    </main>
  );
}
