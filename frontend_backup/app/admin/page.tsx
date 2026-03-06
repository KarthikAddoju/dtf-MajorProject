"use client";

import { useState } from "react";

export default function AdminPage() {
  const [student, setStudent] = useState("");
  const [cid, setCid] = useState("");
  const [eduAmount, setEduAmount] = useState("");
  const [status, setStatus] = useState("");

  const handleMint = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setStatus("Not authenticated");
        return;
      }

      const response = await fetch("http://localhost:4000/api/mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          student,
          cid,
          eduAmount
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error || "Mint failed");
        return;
      }

      setStatus(`Success! TX: ${data.txHash}`);
    } catch {
      setStatus("Error occurred");
    }
  };

  return (
    <div className="p-10 max-w-xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Admin Mint Panel</h1>

      <input
        type="text"
        placeholder="Student Address"
        value={student}
        onChange={(e) => setStudent(e.target.value)}
        className="w-full p-3 mb-4 bg-gray-800 rounded"
      />

      <input
        type="text"
        placeholder="CID"
        value={cid}
        onChange={(e) => setCid(e.target.value)}
        className="w-full p-3 mb-4 bg-gray-800 rounded"
      />

      <input
        type="number"
        placeholder="EDU Amount"
        value={eduAmount}
        onChange={(e) => setEduAmount(e.target.value)}
        className="w-full p-3 mb-4 bg-gray-800 rounded"
      />

      <button
        onClick={handleMint}
        className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded"
      >
        Mint Credential
      </button>

      {status && (
        <div className="mt-6 bg-gray-800 p-4 rounded">
          {status}
        </div>
      )}
    </div>
  );
}