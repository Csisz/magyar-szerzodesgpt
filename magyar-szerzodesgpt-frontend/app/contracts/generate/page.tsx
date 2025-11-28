"use client";

import { useState } from "react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type GenerateResponse = {
  contract_text: string;
  summary_hu: string;
  summary_en?: string | null;
};

export default function ContractGeneratePage() {
  const [type, setType] = useState("Megbízási szerződés");
  const [parties, setParties] = useState("");
  const [subject, setSubject] = useState("");
  const [payment, setPayment] = useState("");
  const [duration, setDuration] = useState("");
  const [specialTerms, setSpecialTerms] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

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
      setError(err.message ?? "Ismeretlen hiba");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-900 text-slate-50 px-4 py-8">
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
                  <Label htmlFor="parties">Felek</Label>
                  <Textarea
                    id="parties"
                    value={parties}
                    onChange={(e) => setParties(e.target.value)}
                    placeholder="pl. Kiss János (megbízó) és Teszt Média Kft. (megbízott)"
                    rows={3}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="subject">A szerződés tárgya</Label>
                  <Textarea
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="pl. online marketing szolgáltatások teljes körű ellátása"
                    rows={3}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="payment">Díjazás / ellenérték</Label>
                  <Input
                    id="payment"
                    value={payment}
                    onChange={(e) => setPayment(e.target.value)}
                    placeholder="pl. havi 200.000 Ft + áfa"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="duration">Időtartam</Label>
                  <Input
                    id="duration"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="pl. határozatlan idő vagy 2025.12.31-ig"
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
          <Card className="bg-slate-800/90 border-slate-700 min-h-[320px]">
            <CardHeader>
              <CardTitle>Eredmény</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
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
                    <h2 className="font-semibold text-lg">
                      Szerződés szövege
                    </h2>
                    <div className="bg-slate-900/70 rounded-md p-3 max-h-[320px] overflow-auto text-sm whitespace-pre-wrap">
                      {result.contract_text}
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
