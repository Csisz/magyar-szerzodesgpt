import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <div className="text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">
            Magyar SzerződésGPT – Frontend
          </h1>
          <p className="text-lg text-slate-300 max-w-xl mx-auto">
            AI-alapú magyar szerződés generálás és elemzés. Válassz egy
            funkciót a kezdéshez.
          </p>
        </div>

        <div className="flex justify-center gap-4">
          <Link
            href="/contracts/generate"
            className="px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-600 text-sm font-medium"
          >
            Szerződés generálása
          </Link>
          <Link
            href="/contracts/review"
            className="px-4 py-2 rounded bg-slate-800 border border-slate-600 hover:bg-slate-700 text-sm font-medium"
          >
            Meglévő szerződés elemzése
          </Link>
        </div>
      </div>
    </main>
  );
}
