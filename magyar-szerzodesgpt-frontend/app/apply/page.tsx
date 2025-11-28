"use client";

import { useState } from "react";
import axios from "axios";

export default function ApplySuggestionsPage() {
  const [original, setOriginal] = useState("");
  const [issuesJson, setIssuesJson] = useState("");
  const [result, setResult] = useState<any>(null);

  async function apply() {
    const issues = JSON.parse(issuesJson);

    const res = await axios.post("http://127.0.0.1:8000/contracts/apply-suggestions", {
      original_contract: original,
      issues_to_apply: issues
    });

    setResult(res.data);
  }

  return (
    <div style={{ padding: "40px", maxWidth: "900px", margin: "0 auto" }}>
      <h1>Javaslatok alkalmazása</h1>

      <textarea
        placeholder="Eredeti szerződés szövege..."
        value={original}
        onChange={(e) => setOriginal(e.target.value)}
        rows={10}
        style={{ width: "100%", padding: 10 }}
      />

      <textarea
        placeholder="Ide illeszd a review issues JSON tömbjét..."
        value={issuesJson}
        onChange={(e) => setIssuesJson(e.target.value)}
        rows={10}
        style={{ width: "100%", padding: 10, marginTop: 20 }}
      />

      <button onClick={apply} style={{ marginTop: 20 }}>
        Javaslatok alkalmazása
      </button>

      {result && (
        <>
          <h2 style={{ marginTop: 30 }}>Változtatások összefoglalója</h2>
          <pre>{result.change_summary}</pre>

          <h2>Módosított szerződés</h2>
          <pre>{result.updated_contract_text}</pre>
        </>
      )}
    </div>
  );
}
