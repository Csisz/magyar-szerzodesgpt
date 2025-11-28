"use client";

import { useState } from "react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

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

type ImproveResponse = {
  improved_text: string;
  summary_hu?: string | null;
};

// Ugyanaz a kulcs, mint a diff oldalon!
const DIFF_STORAGE_KEY = "mszgpt_diff_pair";

export default function ContractReviewPage() {
  const router = useRouter();

  const [contractText, setContractText] = useState("");
  const [contractType, setContractType] = useState("");
  const [partyRole, setPartyRole] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResponse | null>(null);

  // Javított verzióhoz külön state
  const [improving, setImproving] = useState(false);
  const [improveError, setImproveError] = useState<string | null>(null);

  // Fájl feltöltés state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setImproveError(null);

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
        throw new Error(`Hiba a backend hívás közben: ${res.status}`);
      }

      const data = (await res.json()) as ReviewResponse;
      setResult(data);
    } catch (err: any) {
      setError(err.message ?? "Ismeretlen hiba");
    } finally {
      setLoading(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        "http://127.0.0.1:8000/contracts/extract-text",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const msg =
          errData?.detail ||
          `Hiba a fájl feldolgozása közben: ${res.status}`;
        throw new Error(msg);
      }

      const data = (await res.json()) as { text: string };
      setContractText(data.text || "");
    } catch (err: any) {
      setUploadError(
        err.message ?? "Ismeretlen hiba történt a fájl feltöltésekor."
      );
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function riskColor(level: ReviewIssue["risk_level"]) {
    switch (level) {
      case "magas":
        return "bg-red-500/20 text-red-300 border-red-500/40";
      case "közepes":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "alacsony":
      default:
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    }
  }

  function overallRiskText(level: ReviewResponse["overall_risk"]) {
    switch (level) {
      case "magas":
        return "Magas kockázatú szerződés – mindenképp javasolt ügyvéd bevonása.";
      case "közepes":
        return "Közepes kockázat – több ponton javasolt módosítás, ügyvéddel érdemes átbeszélni.";
      case "alacsony":
      default:
        return "Alacsony kockázat – összességében kiegyensúlyozott, de a jelzett pontokra érdemes figyelni.";
    }
  }

  async function handleImproveAndGoToDiff() {
    if (!contractText.trim()) return;
    setImproving(true);
    setImproveError(null);

    try {
      const res = await fetch("http://127.0.0.1:8000/contracts/improve", {
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
          `Hiba a javított verzió lekérése közben: ${res.status}`;
        throw new Error(msg);
      }

      const data = (await res.json()) as ImproveResponse;

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          DIFF_STORAGE_KEY,
          JSON.stringify({
            original: contractText,
            improved: data.improved_text,
          })
        );
      }

      router.push("/contracts/diff");
    } catch (err: any) {
      setImproveError(
        err.message ?? "Ismeretlen hiba történt a javított verzió kérésénél."
      );
    } finally {
      setImproving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-900 text-slate-50 px-4 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        {/* Fejléc */}
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Szerződés review (AI elemzés)
          </h1>
          <p className="text-sm text-slate-300 max-w-3xl">
            Illeszd be a meglévő szerződés szövegét, add meg nagyjából a szerződés
            típusát és a saját szerepedet (pl. megbízó, bérlő), és a Magyar
            SzerződésGPT kiemeli a kockázatos pontokat, közérthető magyarázatokkal.
            Ez nem minősül jogi tanácsadásnak.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)]">
          {/* BAL OLDAL: űrlap */}
          <Card className="bg-slate-800/90 border-slate-700">
            <CardHeader>
              <CardTitle>Szerződés bemásolása</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                {/* Fájl feltöltés */}
                <div className="space-y-2">
                  <Label>Fájl feltöltése (PDF / Word / TXT)</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={handleFileChange}
                      className="text-sm text-slate-200 file:mr-4 file:rounded-md file:border-0 file:bg-emerald-500 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-emerald-600"
                    />
                  </div>
                  <p className="text-xs text-slate-400">
                    A rendszer a feltöltött dokumentumból automatikusan
                    megpróbálja kinyerni a szerződés szövegét és beilleszti a
                    lenti mezőbe.
                  </p>
                  {uploading && (
                    <p className="text-xs text-slate-300">
                      ⏳ Fájl feldolgozása folyamatban…
                    </p>
                  )}
                  {uploadError && (
                    <p className="text-xs text-red-400">❌ {uploadError}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="contract_text">Szerződés szövege</Label>
                  <Textarea
                    id="contract_text"
                    value={contractText}
                    onChange={(e) => setContractText(e.target.value)}
                    placeholder="Illeszd ide a teljes szerződés szövegét..."
                    rows={14}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="contract_type">
                    Szerződés típusa (opcionális)
                  </Label>
                  <Input
                    id="contract_type"
                    value={contractType}
                    onChange={(e) => setContractType(e.target.value)}
                    placeholder="pl. Megbízási szerződés, Bérleti szerződés, Adásvételi szerződés"
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="party_role">A te szereped (opcionális)</Label>
                  <Input
                    id="party_role"
                    value={partyRole}
                    onChange={(e) => setPartyRole(e.target.value)}
                    placeholder="pl. megbízó, megbízott, bérlő, bérbeadó"
                    autoComplete="off"
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
                  disabled={loading || !contractText.trim()}
                >
                  {loading ? "Elemzés folyamatban..." : "Szerződés elemzése"}
                </Button>

                {!contractText.trim() && (
                  <p className="text-xs text-slate-400">
                    Tipp: bemásolhatod a korábban generált szerződés szövegét is a
                    rendszerből.
                  </p>
                )}
              </form>
            </CardContent>
          </Card>

          {/* JOBB OLDAL: eredmény + Diff gomb */}
          <Card className="bg-slate-800/90 border-slate-700 min-h-[320px]">
            <CardHeader>
              <CardTitle>Eredmény (AI elemzés)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {!result && !loading && (
                <p className="text-sm text-slate-400">
                  Itt fog megjelenni az összefoglaló és a kockázatos pontok listája,
                  miután elküldted a szerződést elemzésre.
                </p>
              )}

              {loading && (
                <p className="text-sm text-slate-300">
                  ⏳ A szerződés elemzése folyamatban... Ez néhány másodpercig is
                  eltarthat hosszabb dokumentum esetén.
                </p>
              )}

              {result && (
                <>
                  {/* Összefoglaló */}
                  <section className="space-y-2">
                    <h2 className="font-semibold text-lg">Összefoglaló</h2>
                    <div className="bg-slate-900/70 rounded-md p-3 max-h-[220px] overflow-auto text-sm whitespace-pre-wrap">
                      {result.summary_hu}
                    </div>
                  </section>

                  {/* Általános kockázati szint */}
                  <section className="space-y-2">
                    <h3 className="font-semibold text-base">
                      Általános kockázati szint
                    </h3>
                    <div className="flex flex-col gap-1 text-sm">
                      <span
                        className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-medium ${
                          result.overall_risk === "magas"
                            ? "bg-red-500/20 text-red-300 border-red-500/40"
                            : result.overall_risk === "közepes"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        }`}
                      >
                        {result.overall_risk.toUpperCase()}
                      </span>
                      <p className="text-slate-300">
                        {overallRiskText(result.overall_risk)}
                      </p>
                    </div>
                  </section>

                  {/* Kockázatos pontok */}
                  <section className="space-y-3">
                    <h3 className="font-semibold text-base">
                      Kockázatos / szokatlan pontok
                    </h3>
                    {result.issues.length === 0 && (
                      <p className="text-sm text-slate-400">
                        Az AI nem talált kifejezetten kockázatos vagy szokatlan
                        pontokat, de ez nem helyettesíti az ügyvédi ellenőrzést.
                      </p>
                    )}

                    <div className="space-y-3 max-h-[260px] overflow-auto pr-1">
                      {result.issues.map((issue, idx) => (
                        <div
                          key={idx}
                          className="rounded-md border border-slate-700 bg-slate-900/60 p-3 text-sm space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-200">
                              Problémás pont #{idx + 1}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${riskColor(
                                issue.risk_level
                              )}`}
                            >
                              {issue.risk_level.toUpperCase()}
                            </span>
                          </div>

                          {issue.disadvantaged_party && (
                            <p className="text-xs text-slate-400">
                              Hátrányos lehet:{" "}
                              <span className="font-medium text-slate-200">
                                {issue.disadvantaged_party}
                              </span>
                            </p>
                          )}

                          <div className="space-y-1">
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">
                              Érintett klauzula / részlet
                            </p>
                            <p className="text-slate-200 whitespace-pre-wrap">
                              {issue.clause_excerpt}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">
                              Mi a probléma?
                            </p>
                            <p className="text-slate-100 whitespace-pre-wrap">
                              {issue.issue}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">
                              Javasolt módosítás / alternatíva
                            </p>
                            <p className="text-slate-100 whitespace-pre-wrap">
                              {issue.suggestion}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Javított verzió + Diff nézet gomb */}
                  <section className="space-y-2 pt-2 border-t border-slate-700">
                    {improveError && (
                      <p className="text-sm text-red-400">
                        ❌ {improveError}
                      </p>
                    )}
                    <Button
                      type="button"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                      disabled={improving || !contractText.trim()}
                      onClick={handleImproveAndGoToDiff}
                    >
                      {improving
                        ? "Javított verzió készítése..."
                        : "Javított verzió + Diff nézet megtekintése"}
                    </Button>
                    <p className="text-xs text-slate-400">
                      A gomb megnyomására az AI elkészíti a javított szerződés
                      szövegét, majd automatikusan a Diff nézetben hasonlíthatod
                      össze az eredeti és a módosított változatot.
                    </p>
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
