"use client";

import { useState } from "react";
import axios from "axios";

export default function ReviewContractPage() {
  const [text, setText] = useState("");
  const [partyRole, setPartyRole] = useState("");
  const [contractType, setContractType] = useState("");
  const [review, setReview] = useState<any>(null);

  async function doReview() {
    const res = await axios.post("http://127.0.0.1:8000/contracts/review", {
      contract_text: text,
      contract_type: contractType,
      party_role: partyRole,
    });
    setReview(res.data);
  }

  return (
    <div style={{ padding: "40px", maxWidth: "900px", margin: "0 auto" }}>
      <h1>Szerződés Review</h1>

      <textarea
        placeholder="Illeszd be a szerződés szövegét..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        style={{ width: "100%", padding: "10px" }}
      />

      <input
        placeholder="Szerződés típusa"
        value={contractType}
        onChange={(e) => setContractType(e.target.value)}
        style={{ marginTop: 10, padding: 8, width: "100%" }}
      />

      <input
        placeholder="A te szereped (pl. megbízó)"
        value={partyRole}
        onChange={(e) => setPartyRole(e.target.value)}
        style={{ marginTop: 10, padding: 8, width: "100%" }}
      />

      <button onClick={doReview} style={{ marginTop: 20 }}>
        Elemzés indítása
      </button>

      {review && (
        <>
          <h2 style={{ marginTop: 30 }}>Összefoglaló</h2>
          <pre>{review.summary_hu}</pre>

          <h2>Kockázatos pontok:</h2>
          {review.issues.map((issue: any, i: number) => (
            <div key={i} style={{ border: "1px solid #ddd", padding: 10, marginTop: 10 }}>
              <strong>Részlet:</strong> {issue.clause_excerpt}
              <br />
              <strong>Gond:</strong> {issue.issue}
              <br />
              <strong>Kockázat:</strong> {issue.risk_level}
              <br />
              <strong>Javaslat:</strong> {issue.suggestion}
              <br />
            </div>
          ))}

          <a href="/apply">➡️ Javaslatok alkalmazása</a>
        </>
      )}
    </div>
  );
}
