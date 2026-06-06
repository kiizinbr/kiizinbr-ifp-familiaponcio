import {
  statusConsentimento,
  VERSAO_TERMO_TRATAMENTO,
  type ConsentimentoRec,
} from "@/lib/consentimento";
import {
  registrarConsentimentoTratamentoAction,
  revogarConsentimentoTratamentoAction,
  registrarConsentimentoImagemAction,
} from "./consentimento-actions";

const box: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: 16,
  background: "var(--surface)",
};
const btn: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid var(--line)",
  background: "var(--surface-2)",
  cursor: "pointer",
  fontSize: 13,
  fontFamily: "inherit",
};

/**
 * Seção de consentimentos LGPD na ficha (base legal). Só exibida/editável por staff
 * (podeGerirConsentimento, checado pelo caller). Registra o aceite do termo físico:
 * versão + data + quem (auditado). Imagem é granular e revogável por escopo.
 */
export function ConsentimentoSection({
  cidadaoId,
  consentimentos,
}: {
  cidadaoId: string;
  consentimentos: ConsentimentoRec[];
}) {
  const s = statusConsentimento(consentimentos);

  return (
    <section style={{ ...box, display: "grid", gap: 16 }}>
      <h3 style={{ margin: 0, color: "var(--text)", fontSize: 15 }}>Consentimentos (LGPD)</h3>

      {/* Tratamento de dados */}
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontSize: 13, color: "var(--text)" }}>
          <b>Tratamento de dados</b> ·{" "}
          {s.tratamento.vigente ? (
            <span style={{ color: "var(--success, #1a7f4b)" }}>
              ✓ aceito ({s.tratamento.versao})
              {s.tratamento.desatualizado ? " — termo atualizou, re-registre" : ""}
            </span>
          ) : (
            <span style={{ color: "var(--text-3)" }}>não registrado</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <form action={registrarConsentimentoTratamentoAction}>
            <input type="hidden" name="cidadaoId" value={cidadaoId} />
            <button type="submit" style={btn}>
              {s.tratamento.vigente
                ? `Re-registrar (${VERSAO_TERMO_TRATAMENTO})`
                : "Registrar aceite do termo"}
            </button>
          </form>
          {s.tratamento.vigente ? (
            <form action={revogarConsentimentoTratamentoAction}>
              <input type="hidden" name="cidadaoId" value={cidadaoId} />
              <button type="submit" style={{ ...btn, color: "var(--danger)" }}>
                Revogar
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {/* Uso de imagem (granular) */}
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontSize: 13, color: "var(--text)" }}>
          <b>Uso de imagem</b> — autorize por escopo:
        </div>
        <form action={registrarConsentimentoImagemAction} style={{ display: "grid", gap: 8 }}>
          <input type="hidden" name="cidadaoId" value={cidadaoId} />
          <label style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--text)" }}>
            <input type="checkbox" name="interno" defaultChecked={s.imagem.interno} /> Uso interno
            (relatórios / institucional)
          </label>
          <label style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--text)" }}>
            <input type="checkbox" name="redes" defaultChecked={s.imagem.redes} /> Redes sociais do
            IFP
          </label>
          <label style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--text)" }}>
            <input type="checkbox" name="imprensa" defaultChecked={s.imagem.imprensa} /> Imprensa /
            mídia externa
          </label>
          <button type="submit" style={{ ...btn, justifySelf: "start" }}>
            Salvar consentimento de imagem
          </button>
        </form>
      </div>

      <p style={{ margin: 0, fontSize: 11, color: "var(--text-3)" }}>
        Registre o que o cidadão assinou no termo físico. Cada registro guarda versão, data e quem
        registrou (auditado).
      </p>
    </section>
  );
}
