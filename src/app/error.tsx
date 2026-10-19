"use client";
import { useEffect } from "react";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { /* O detalhe técnico fica nos logs do servidor, nunca na tela pública. */ }, []);
  return <main className="buy-section" style={{ minHeight: "100vh", display: "grid", placeItems: "center", textAlign: "center" }}>
    <div style={{ maxWidth: 520 }}><div className="script">Ops!</div><h1>Estamos preparando a rifa</h1><p>Não foi possível carregar os números neste momento. Tente novamente em instantes.</p><button className="primary" onClick={() => reset()}>Tentar novamente</button></div>
  </main>;
}
