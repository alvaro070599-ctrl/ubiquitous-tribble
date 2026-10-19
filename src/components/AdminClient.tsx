"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type NumberRow = { number: number; status: string };
type OrderRow = {
  id: string; buyerName: string; buyerEmail: string; buyerPhone: string;
  numbers: string; amountCents: number; status: string; createdAt: string;
};
type SharpixelConfig = {
  cpf: string; nome: string; nomeComercial: string; cnpj: string;
  email: string; telefone: string; endereco: string;
};
type EditableSettings = {
  title: string; priceCents: number; drawDate: string; instagram: string;
  pixKey: string; pixName: string; pixKeyConfigured?: boolean; pixNameConfigured?: boolean;
};
type AdminData = { settings: Omit<EditableSettings, "pixKey" | "pixName"> | null; numbers: NumberRow[]; orders: OrderRow[]; sharpixel?: SharpixelConfig };

const DEFAULT_SETTINGS: EditableSettings = {
  title: "Rifa em prol do nosso casamento", priceCents: 1000,
  drawDate: "30 de novembro", instagram: "@joaoenicky", pixKey: "", pixName: ""
};

async function readResponse(response: Response): Promise<Record<string, any>> {
  try { return await response.json(); } catch { return {}; }
}
function formatMoney(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PAID: "PAGO", PENDING: "PENDENTE", PAID_REVIEW: "PAGAMENTO A REVISAR",
    EXPIRED: "EXPIRADO", CANCELLED: "CANCELADO"
  };
  return labels[status] || status;
}

export default function AdminClient() {
  const [password, setPassword] = useState("");
  const [logged, setLogged] = useState(false);
  const [data, setData] = useState<AdminData | null>(null);
  const [settings, setSettings] = useState<EditableSettings>(DEFAULT_SETTINGS);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/data", { cache: "no-store" });
      const payload = await readResponse(response);
      if (response.ok) {
        const nextData = payload as AdminData;
        setData(nextData);
        setSettings(current => ({ ...current, ...(nextData.settings ?? {}), pixKey: "", pixName: "" }));
        setLogged(true);
      } else if (response.status !== 401) {
        setMessage(String(payload.error || "Não foi possível carregar o painel."));
      }
    } catch {
      setMessage("Falha de conexão ao carregar o painel.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        setMessage(String(payload.error || "Não foi possível entrar no painel."));
        return;
      }
      setPassword("");
      setMessage("");
      await load();
    } catch {
      setMessage("Falha de conexão ao autenticar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const payload: Partial<EditableSettings> = { ...settings };
      // O servidor não devolve a chave cadastrada. Campo vazio significa “não alterar”.
      if (!settings.pixKey.trim()) delete payload.pixKey;
      if (!settings.pixName.trim()) delete payload.pixName;
      delete payload.pixKeyConfigured;
      delete payload.pixNameConfigured;
      const response = await fetch("/api/admin/data", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      const result = await readResponse(response);
      if (!response.ok) {
        setMessage(String(result.error || "Não foi possível salvar as configurações."));
        return;
      }
      setMessage("Configurações salvas.");
      await load();
    } catch {
      setMessage("Falha de conexão ao salvar. Confira o banco de dados e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmPayment(orderId: string) {
    const sure = window.confirm("Confirme somente se você verificou o recebimento real do Pix na sua conta. Deseja marcar este pedido como pago?");
    if (!sure) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/confirm", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId })
      });
      const result = await readResponse(response);
      setMessage(response.ok ? "Pagamento confirmado e números atualizados." : String(result.error || "Não foi possível confirmar."));
      await load();
    } catch {
      setMessage("Falha de conexão ao confirmar. Atualize o painel e verifique o pedido.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try { await fetch("/api/admin/logout", { method: "POST" }); } finally {
      setLogged(false); setData(null); setPassword(""); setMessage("Sessão encerrada.");
    }
  }

  if (!logged) {
    return <main className="admin-wrap"><div className="admin-card">
      <div className="topline">NICOLLY &amp; JOÃO</div><h1>Painel administrativo</h1><p>Entre para gerenciar a rifa.</p>
      <form onSubmit={login}>
        <label>Senha de administrador<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required /></label>
        <button className="primary" disabled={busy}>{busy ? "Verificando…" : "Entrar"}</button>
      </form>
      {message && <p className="notice" role="status">{message}</p>}
      <a href="/">← Voltar para a rifa</a>
    </div></main>;
  }

  const numbers = data?.numbers ?? [];
  const orders = data?.orders ?? [];
  const sharpixel = data?.sharpixel;
  const companyFields: Array<[string, string | undefined]> = [
    ["Nome comercial", sharpixel?.nomeComercial], ["Nome completo / razão social", sharpixel?.nome],
    ["CPF", sharpixel?.cpf], ["CNPJ", sharpixel?.cnpj], ["E-mail", sharpixel?.email],
    ["Telefone", sharpixel?.telefone], ["Endereço", sharpixel?.endereco]
  ];

  return <main className="admin-wrap"><div className="admin-content">
    <div className="admin-title"><div><div className="topline">NICOLLY &amp; JOÃO</div><h1>Painel da rifa</h1></div><button className="secondary" onClick={logout}>Sair</button></div>
    {message && <p className="notice" role="status">{message}</p>}

    <section className="admin-card"><h2>Configurações da campanha</h2>
      <form onSubmit={save}>
        <label>Nome da rifa<input value={settings.title} onChange={event => setSettings(current => ({ ...current, title: event.target.value }))} maxLength={120} required /></label>
        <label>Valor por número (R$)<input type="number" min="1" max="10000" step="0.01" value={settings.priceCents / 100} onChange={event => setSettings(current => ({ ...current, priceCents: Math.round(Number(event.target.value) * 100) }))} required /></label>
        <label>Data do sorteio<input value={settings.drawDate} onChange={event => setSettings(current => ({ ...current, drawDate: event.target.value }))} maxLength={80} /></label>
        <label>Instagram<input value={settings.instagram} onChange={event => setSettings(current => ({ ...current, instagram: event.target.value }))} maxLength={80} /></label>
        <label>Chave Pix (referência administrativa)<input value={settings.pixKey} onChange={event => setSettings(current => ({ ...current, pixKey: event.target.value }))} placeholder={settings.pixKeyConfigured ? "Chave já cadastrada; digite apenas para substituir" : "Chave Pix do organizador"} maxLength={200} /></label>
        <label>Nome do recebedor<input value={settings.pixName} onChange={event => setSettings(current => ({ ...current, pixName: event.target.value }))} placeholder={settings.pixNameConfigured ? "Nome já cadastrado; digite apenas para substituir" : "Nome do titular"} maxLength={120} /></label>
        <p className="privacy">A chave Pix salva aqui não é devolvida ao navegador. O checkout automático usa Pix dinâmico do Mercado Pago; essa chave estática é apenas referência e não substitui o token nem o segredo do webhook.</p>
        <button className="primary" disabled={busy}>{busy ? "Salvando…" : "Salvar configurações"}</button>
      </form>
    </section>

    <section className="admin-card"><h2>Dados cadastrais da Sharpixel</h2>
      <p className="privacy">Esses dados vêm das variáveis de ambiente da Vercel. Só são exibidos neste painel autenticado e não são enviados à página pública.</p>
      <div className="company-grid">{companyFields.map(([label, value]) => <div className="company-field" key={label}><small>{label}</small><b>{value || "Não configurado"}</b></div>)}</div>
      <p className="privacy">Para alterar esses valores, acesse Vercel → Project → Settings → Environment Variables e faça um novo deploy para aplicar as alterações.</p>
    </section>

    <section className="admin-card"><h2>Resumo dos números</h2><div className="admin-stats">
      <div><strong>{numbers.filter(number => number.status === "AVAILABLE").length}</strong><span>Disponíveis</span></div>
      <div><strong>{numbers.filter(number => number.status === "PENDING").length}</strong><span>Reservados</span></div>
      <div><strong>{numbers.filter(number => number.status === "PAID").length}</strong><span>Pagos</span></div>
    </div></section>

    <section className="admin-card"><h2>Pedidos recentes</h2><div className="orders">
      {orders.length === 0 && <p>Nenhuma compra registrada ainda.</p>}
      {orders.map(order => <article className="order" key={order.id}>
        <div><b>{order.buyerName}</b><small>{order.buyerEmail} · {order.buyerPhone}</small><small>Números: {order.numbers}</small><small>{new Date(order.createdAt).toLocaleString("pt-BR")}</small></div>
        <div className="order-side"><b>{formatMoney(order.amountCents)}</b><span className={`status ${order.status.toLowerCase()}`}>{statusLabel(order.status)}</span>
          {order.status === "PENDING" && <button className="secondary small" disabled={busy} onClick={() => void confirmPayment(order.id)}>Confirmar Pix recebido</button>}
          {order.status === "PAID_REVIEW" && <small>Verifique o pagamento no Mercado Pago e resolva sem tomar números de outro comprador.</small>}
        </div>
      </article>)}
    </div></section>
    <p><a href="/">← Ver página pública</a></p>
  </div></main>;
}
