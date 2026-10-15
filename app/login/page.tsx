"use client";

import { useState } from "react";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (response.ok) {
        window.location.replace("/");
        return;
      }
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Login failed.");
      setPin("");
    } catch {
      setError("Could not reach the server.");
    }
    setBusy(false);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-xs space-y-4 rounded-xl bg-white p-6 shadow">
        <h1 className="text-center">
          <span className="block text-2xl font-semibold">Vansh</span>
          <span className="sr-only"> - </span>
          <span className="block text-sm text-slate-500">The family tree</span>
        </h1>
        <label htmlFor="pin" className="block text-center text-sm text-slate-600">
          Enter the 6-digit PIN
        </label>
        <input
          id="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]{6}"
          autoComplete="current-password"
          autoFocus
          maxLength={6}
          className="w-full rounded-md border border-slate-300 px-3 py-3 text-center text-2xl tracking-[0.5em]"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />
        {error && <p className="text-center text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || pin.length !== 6}
          className="w-full rounded-md bg-slate-900 py-2.5 text-white disabled:opacity-50"
        >
          {busy ? "Checking..." : "Log in"}
        </button>
      </form>
    </main>
  );
}
