/**
 * Galeria CASA (Fase 0 da ponte design→React).
 * Prova que o React renderiza os componentes-assinatura idênticos ao Atlas,
 * recolorindo por unidade via [data-theme]. Rota dev: /casa-ui.
 */
import { Brandmark, CrestAvatar, JubaRing, CoroaSeal } from "@/components/casa";

const TEMAS = [
  { id: "presidencia", nome: "Corte · Presidência" },
  { id: "medico", nome: "Centro Médico" },
  { id: "capacitacao", nome: "Capacitação" },
  { id: "educacional", nome: "Educacional" },
  { id: "esportivo", nome: "Esportivo" },
  { id: "servico-social", nome: "Serviço Social" },
] as const;

function Bloco({ id, nome }: { id: string; nome: string }) {
  return (
    <section
      data-theme={id}
      style={{
        background: "var(--ifp-white)",
        border: "1px solid var(--ifp-linha)",
        borderRadius: 18,
        padding: 20,
        boxShadow: "var(--ifp-shadow-casa-sm)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span style={{ color: "var(--unidade)" }}>
          <Brandmark size={34} title={`Leão ${nome}`} />
        </span>
        <div>
          <div style={{ fontWeight: 600, color: "var(--ifp-tinta)", letterSpacing: "0.04em" }}>{nome}</div>
          <code style={{ fontSize: 11, color: "#9a8f84" }}>data-theme=&quot;{id}&quot;</code>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <div style={{ textAlign: "center" }}>
          <CrestAvatar iniciais="ER" size={52} />
          <div style={{ fontSize: 10, color: "#9a8f84", marginTop: 6 }}>CrestAvatar</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <JubaRing pct={72} size={64} />
          <div style={{ fontSize: 10, color: "#9a8f84", marginTop: 6 }}>JubaRing</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <CoroaSeal status="aprovado">Aprovado</CoroaSeal>
          <CoroaSeal status="analise">Em análise</CoroaSeal>
          <CoroaSeal status="bloqueado">Bloqueado</CoroaSeal>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["var(--unidade)", "var(--unidade-escuro)", "var(--unidade-suave)", "var(--ifp-dourado)"].map((c) => (
            <span
              key={c}
              title={c}
              style={{ width: 34, height: 34, borderRadius: 8, background: c, border: "1px solid var(--ifp-linha)" }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function CasaGaleriaPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--ifp-papel)",
        padding: "40px 30px 80px",
        fontFamily: "var(--ifp-font-family)",
      }}
    >
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <header style={{ textAlign: "center", marginBottom: 28 }}>
          <span style={{ color: "var(--ifp-tinta)", display: "inline-block" }}>
            <Brandmark size={56} title="IFP" />
          </span>
          <h1 style={{ fontSize: 30, fontWeight: 700, color: "var(--ifp-tinta)", margin: "10px 0 4px" }}>
            CASA · Galeria de componentes
          </h1>
          <p style={{ color: "#9a8f84", fontSize: 14, margin: 0 }}>
            Fase 0 — componentes-assinatura em React, recolorindo por unidade. Equivale ao Atlas.
          </p>
          <a
            href="/casa-ui/shell"
            style={{
              display: "inline-block",
              marginTop: 14,
              padding: "10px 18px",
              borderRadius: 11,
              background: "var(--ifp-tinta)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Ver o Shell completo (topbar + rail) →
          </a>
        </header>
        <div style={{ display: "grid", gap: 16 }}>
          {TEMAS.map((t) => (
            <Bloco key={t.id} id={t.id} nome={t.nome} />
          ))}
        </div>
      </div>
    </main>
  );
}
