 "use client";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type RaffleNum = { number: number; status: string };
type Settings = { title: string; priceCents: number; drawDate: string; instagram: string };
export default function RaffleClient({ numbers, settings, counts }: { numbers: RaffleNum[]; settings: Settings; counts: {available:number;pending:number;paid:number} }) {
  const [selected, setSelected] = useState<number[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [payment, setPayment] = useState<{qr?:string; image?:string; ticket?:string; orderId?:string; status?:string; paymentAvailable?:boolean} | null>(null);
  const [filter, setFilter] = useState("AVAILABLE");
  const statusMap = useMemo(() => new Map(numbers.map(n => [n.number, n.status])), [numbers]);
  const total = selected.length * settings.priceCents;
  const fmt = (cents:number) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(cents/100);
  function toggle(n:number) {
    if (statusMap.get(n) !== "AVAILABLE" || payment) return;
    setSelected(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n].sort((a,b)=>a-b));
    setNotice("");
  }
  async function checkout() {
    setNotice("");
    if (!selected.length) return setNotice("Selecione pelo menos um número disponível.");
    if (!name.trim() || !email.trim() || !phone.trim()) return setNotice("Preencha nome, e-mail e telefone.");
    setBusy(true);
    try {
      const response = await fetch("/api/checkout", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ numbers:selected, name, email, phone }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível criar o pagamento.");
      setPayment({ ...data, status: "PENDING" });
      setNotice("Reserva criada! Finalize o Pix pelo QR Code ou botão abaixo. Os números ficam reservados por 15 minutos.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Erro inesperado."); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (!payment?.orderId || payment.status !== "PENDING") return;
    let stopped = false;
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(payment.orderId!)}`, { cache: "no-store" });
        if (!response.ok) return;
        const data: { status?: string } = await response.json();
        if (stopped || !data.status) return;
        if (data.status !== "PENDING") {
          setPayment(current => current ? { ...current, status: data.status } : current);
          if (data.status === "PAID") setNotice("Pagamento aprovado! Seus números estão confirmados. Obrigado por participar! ♡");
          else if (data.status === "PAID_REVIEW") setNotice("O pagamento foi recebido, mas a reserva precisa ser conferida pelo organizador. Guarde o número do pedido.");
          else if (data.status === "EXPIRED" || data.status === "CANCELLED") setNotice("Esta reserva expirou ou foi cancelada. Atualize a página antes de escolher outros números.");
        }
      } catch { /* O próximo ciclo tenta consultar novamente. */ }
    };
    void checkStatus();
    const timer = window.setInterval(() => { void checkStatus(); }, 5000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [payment?.orderId, payment?.status]);
  return <main>
    <section className="hero">
      <div className="floral floral-left">✿ ❀ ✧</div>
      <div className="topline">NICOLLY &amp; JOÃO</div>
      <div className="tiny-heart">♡</div>
      <h1>RIFA</h1>
      <p className="subtitle">EM PROL DO NOSSO</p>
      <div className="script">casamento</div>
      {settings.title && settings.title !== "Rifa em prol do nosso casamento" && <p className="campaign-caption">{settings.title}</p>}
      <p className="intro">Estamos arrecadando fundos para realizar<br className="desktop"/> o sonho do nosso casamento e contamos<br className="desktop"/> com a tua ajuda!</p>
      <div className="ribbon">♡ &nbsp; 5 PRÊMIOS INCRÍVEIS &nbsp; ♡</div>
      <div className="prizes">
        <article className="prize"><div className="prize-photo"><Image src="/prizes/air-fryer.jpg" alt="Air fryer preta Elgin" width={400} height={360} sizes="(max-width: 600px) 30vw, 220px" priority /></div><div className="prize-label"><b>1º</b> Air Fryer</div></article>
        <article className="prize"><div className="prize-photo"><Image src="/prizes/cesta-especial.jpg" alt="Cesta especial com bebidas e chocolates" width={400} height={360} sizes="(max-width: 600px) 30vw, 220px" /></div><div className="prize-label"><b>2º</b> Cesta especial</div></article>
        <article className="prize"><div className="prize-photo"><Image src="/prizes/pipoqueira.jpg" alt="Pipoqueira elétrica vermelha" width={400} height={360} sizes="(max-width: 600px) 30vw, 220px" /></div><div className="prize-label"><b>3º</b> Pipoqueira</div></article>
        <article className="prize"><div className="prize-photo"><Image src="/prizes/perfume-babyliss.jpg" alt="Perfume e modelador Babyliss" width={400} height={360} sizes="(max-width: 600px) 30vw, 220px" /></div><div className="prize-label"><b>4º</b> Perfume + Babyliss</div></article>
        <article className="prize"><div className="prize-photo"><Image src="/prizes/jantar-facas.jpg" alt="Jogo de jantar e conjunto de facas" width={400} height={360} sizes="(max-width: 600px) 30vw, 220px" /></div><div className="prize-label"><b>5º</b> Jogo de facas + jantar (12 peças)</div></article>
      </div>
      <div className="stats">
        <div><strong>500</strong><small>NÚMEROS</small></div><span className="stat-sep"/>
        <div><strong>{fmt(settings.priceCents)}</strong><small>CADA NÚMERO</small></div>
      </div>
      <div className="eventline"><span>▦ <b>SORTEIO<br/>{settings.drawDate}</b></span><span>◎ <b>LIVE<br/>AO VIVO PELO NOSSO INSTAGRAM!</b></span><span className="handle">{settings.instagram}</span></div>
      <div className="script footer-script">Cada número nos aproxima<br/>desse sonho!</div>
      <p className="thanks">Agradecemos de coração por cada contribuição! ♡</p>
    </section>

    <section className="buy-section" id="comprar">
      <div className="section-heading"><span>♡</span><h2>Escolha seus números</h2><p>Selecione um ou mais números disponíveis para participar.</p></div>
      <div className="legend"><span><i className="available"/> Disponível ({counts.available})</span><span><i className="pending"/> Reservado ({counts.pending})</span><span><i className="paid"/> Pago ({counts.paid})</span></div>
      <div className="filter-row">
        <label htmlFor="filter">Visualizar:</label><select id="filter" value={filter} onChange={e=>setFilter(e.target.value)}><option value="AVAILABLE">Disponíveis</option><option value="ALL">Todos os números</option></select>
        <span className="selected-count">{selected.length} selecionado(s)</span>
      </div>
      {numbers.length === 0 ? <p className="notice" role="status">Os números estão temporariamente indisponíveis. Tente novamente em instantes.</p> : <div className="number-grid">
        {numbers.filter(n=>filter==="ALL" || n.status==="AVAILABLE").map(n=><button key={n.number} disabled={n.status!=="AVAILABLE" || !!payment} onClick={()=>toggle(n.number)} className={`number ${n.status.toLowerCase()} ${selected.includes(n.number)?"chosen":""}`} title={n.status==="AVAILABLE"?"Selecionar número":n.status==="PAID"?"Número pago":"Número reservado"}>{String(n.number).padStart(3,"0")}</button>)}
      </div>}
      <div className="checkout-card">
        <div className="checkout-head"><div><span className="eyebrow">SUA PARTICIPAÇÃO</span><h3>Finalize sua reserva</h3></div><div className="total"><small>Total</small><strong>{fmt(total)}</strong></div></div>
        {!payment ? <form onSubmit={e=>{e.preventDefault(); void checkout();}}>
          <div className="form-grid">
            <label>Nome completo<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" placeholder="Seu nome" required/></label>
            <label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="voce@email.com" required/></label>
            <label className="full">WhatsApp / telefone<input value={phone} onChange={e=>setPhone(e.target.value)} autoComplete="tel" placeholder="(00) 00000-0000" required/></label>
          </div>
          <button className="primary" type="submit" disabled={busy}>{busy?"Gerando Pix...":`Reservar e pagar ${fmt(total)}`}</button>
          <p className="privacy">Seus dados serão usados somente para identificar a compra e a participação na rifa.</p>
        </form> : <div className="payment-box">
          <h3>{payment.status === "PAID" ? "Pagamento aprovado" : "Pagamento Pix"}</h3>
          <p>Pedido: <b>{payment.orderId}</b></p>
          {payment.status === "PAID" ? <p className="payment-success">Pagamento confirmado. Seus números já estão registrados! ♡</p> : null}
          {payment.status === "PAID_REVIEW" ? <p className="notice">Pagamento recebido, mas é necessária uma revisão da reserva. Entre em contato com o organizador e informe o número do pedido.</p> : null}
          {payment.status === "PENDING" && payment.image && <img className="qr" src={`data:image/png;base64,${payment.image}`} alt="QR Code Pix para pagamento"/>}
          {payment.status === "PENDING" && payment.qr && <><p>Abra o aplicativo do seu banco e escaneie o QR Code ou copie o código Pix:</p><textarea readOnly value={payment.qr}/><button className="secondary" onClick={async()=>{try { await navigator.clipboard.writeText(payment.qr!); setNotice("Código Pix copiado."); } catch { setNotice("Não foi possível copiar automaticamente. Selecione e copie o código Pix manualmente."); }}}>Copiar código Pix</button></>}
          {payment.status === "PENDING" && payment.ticket && <a className="primary link-button" href={payment.ticket} target="_blank" rel="noreferrer">Abrir pagamento Pix</a>}
          {payment.status === "PENDING" && !payment.qr && !payment.ticket && <p className="notice">O provedor não devolveu os dados do QR Code. Não faça outra compra. Informe o número do pedido ao organizador.</p>}
          {payment.status === "PENDING" && <p className="privacy">Estamos verificando o pagamento automaticamente. A reserva expira após 15 minutos se o pagamento não for concluído.</p>}
          {(payment.status === "EXPIRED" || payment.status === "CANCELLED") && <button className="secondary" onClick={()=>window.location.reload()}>Atualizar e escolher novamente</button>}
        </div>}
        {notice && <p className="notice" role="status">{notice}</p>}
      </div>
    </section>
    <footer>Feito com carinho para Nicolly &amp; João <span>♡</span></footer>
  </main>;
}
