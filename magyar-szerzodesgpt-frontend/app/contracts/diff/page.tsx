"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DiffLine = {
  text: string;
  type: "same" | "changed";
};

function computeLineDiff(leftText: string, rightText: string): {
  left: DiffLine[];
  right: DiffLine[];
} {
  const leftLines = leftText.split(/\r?\n/);
  const rightLines = rightText.split(/\r?\n/);

  const maxLen = Math.max(leftLines.length, rightLines.length);
  const left: DiffLine[] = [];
  const right: DiffLine[] = [];

  for (let i = 0; i < maxLen; i++) {
    const l = leftLines[i] ?? "";
    const r = rightLines[i] ?? "";
    const type: DiffLine["type"] = l === r ? "same" : "changed";
    left.push({ text: l, type });
    right.push({ text: r, type });
  }

  return { left, right };
}

/**
 * Ezzel a kulccsal fogjuk majd (később) a review oldalról előtölteni az adatokat.
 */
const DIFF_STORAGE_KEY = "mszgpt_diff_pair";

export default function ContractDiffPage() {
  const [original, setOriginal] = useState("");
  const [improved, setImproved] = useState("");

  const [leftDiff, setLeftDiff] = useState<DiffLine[]>([]);
  const [rightDiff, setRightDiff] = useState<DiffLine[]>([]);

  // Ha a review / generate oldal egyszer elmentette localStorage-ba, innen be tudjuk tölteni.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DIFF_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          original?: string;
          improved?: string;
        };
        if (parsed.original) setOriginal(parsed.original);
        if (parsed.improved) setImproved(parsed.improved);
      }
    } catch {
      // nem baj, ha nincs vagy rossz
    }
  }, []);

  useEffect(() => {
    const { left, right } = computeLineDiff(original, improved);
    setLeftDiff(left);
    setRightDiff(right);
  }, [original, improved]);

  function handleSaveToLocalStorage() {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      DIFF_STORAGE_KEY,
      JSON.stringify({ original, improved })
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-slate-50 px-4 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        {/* Fejléc */}
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Javítások alkalmazása – Diff nézet
          </h1>
          <p className="text-sm text-slate-300 max-w-3xl">
            Bal oldalon az eredeti szerződés szövege, jobb oldalon az AI által
            módosított/javított verzió. Lent soronkénti diff mutatja, hol vannak
            eltérések. Ez a felület segít átlátni, pontosan mit változtatna a
            rendszer – de fontosabb szerződéseknél továbbra is javasolt ügyvéddel
            egyeztetni.
          </p>
        </header>

        {/* Felső rész: kézi / automatikus szövegbevitel */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="bg-slate-800/90 border-slate-700">
            <CardHeader>
              <CardTitle>Eredeti szerződés</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={original}
                onChange={(e) => setOriginal(e.target.value)}
                placeholder="Illeszd be az eredeti szerződés szövegét..."
                rows={14}
              />
            </CardContent>
          </Card>

          <Card className="bg-slate-800/90 border-slate-700">
            <CardHeader>
              <CardTitle>Javított / módosított szerződés</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={improved}
                onChange={(e) => setImproved(e.target.value)}
                placeholder="Illeszd be az AI által javított szerződés szövegét..."
                rows={14}
              />
              <p className="text-xs text-slate-400">
                Később ezt a részt automatikusan kitölthetjük a review oldalról,
                amikor az AI elkészíti a javított verziót.
              </p>
              <Button
                type="button"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
                onClick={handleSaveToLocalStorage}
              >
                Jelenlegi állapot mentése (diff-hez)
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Alsó rész: soronkénti diff */}
        <Card className="bg-slate-800/90 border-slate-700">
          <CardHeader>
            <CardTitle>Soronkénti különbségek</CardTitle>
          </CardHeader>
          <CardContent>
            {(!original.trim() && !improved.trim()) && (
              <p className="text-sm text-slate-400">
                Add meg fent az eredeti és a javított szöveget – a rendszer itt
                soronként kiemeli, hol tér el egymástól a két verzió.
              </p>
            )}

            {(original.trim() || improved.trim()) && (
              <div className="grid gap-4 md:grid-cols-2 max-h-[420px] overflow-auto">
                <div className="space-y-1">
                  <p className="text-xs text-slate-400 mb-1">
                    Eredeti szöveg (eltérések pirossal jelölve)
                  </p>
                  <div className="rounded-md bg-slate-900/80 border border-slate-700 text-xs font-mono">
                    {leftDiff.map((line, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "px-2 py-1 border-b border-slate-800 last:border-0 whitespace-pre-wrap",
                          line.type === "changed" &&
                            "bg-red-900/30 text-red-100"
                        )}
                      >
                        {line.text || "\u00A0"}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400 mb-1">
                    Javított szöveg (eltérések zölddel jelölve)
                  </p>
                  <div className="rounded-md bg-slate-900/80 border border-slate-700 text-xs font-mono">
                    {rightDiff.map((line, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "px-2 py-1 border-b border-slate-800 last:border-0 whitespace-pre-wrap",
                          line.type === "changed" &&
                            "bg-emerald-900/30 text-emerald-100"
                        )}
                      >
                        {line.text || "\u00A0"}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
