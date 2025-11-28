"use client";

import { useState } from "react";
import axios from "axios";

export default function GenerateContractPage() {
  const [form, setForm] = useState({
    type: "",
    parties: "",
    subject: "",
    payment: "",
    duration: "",
    special_terms: "",
  });

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function generateContract() {
    setLoading(true);
    const res = await axios.post("http://127.0.0.1:8000/contracts/generate", form);
    setResult(res.data);
    setLoading(false);
  }

  return (
    <div style={{ padding: "40px", maxWidth: "900px", margin: "0 auto" }}>
      <h1>Szerződés Generálás</h1>

      <div className="form">
        {Object.keys(form).map((key) => (
          <div key={key} style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "4px" }}>{key}</label>
            <input
              style={{ width: "100%", padding: "8px" }}
              value={(form as any)[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </div>
        ))}

        <button onClick={generateContract} disabled={loading}>
          {loading ? "Generálás folyamatban..." : "Szerződés Generálása"}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: "40px" }}>
          <h2>Generált szerződés</h2>
          <pre>{result.contract_text}</pre>

          <h3>Összefoglaló</h3>
          <pre>{result.summary_hu}</pre>

          <a href="/review">➡️ Review indítása ehhez</a>
        </div>
      )}
    </div>
  );
}
