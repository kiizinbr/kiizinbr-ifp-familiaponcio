import { describe, expect, it } from "vitest";
import {
  diasAguardando,
  fraseEstado,
  horaEmSaoPaulo,
  labelEspera,
  quadroDasCasas,
  saudacao,
} from "@/lib/hub-inicio";
import { UNIDADES } from "@/lib/unidades";

function textoDe(segmentos: { t: string }[]): string {
  return segmentos.map((s) => s.t).join("");
}

describe("saudacao", () => {
  it("limites exatos do bom dia (5–11)", () => {
    // Arrange/Act/Assert nos limites
    expect(saudacao(5)).toBe("Bom dia");
    expect(saudacao(11)).toBe("Bom dia");
  });

  it("limites exatos da boa tarde (12–17)", () => {
    expect(saudacao(12)).toBe("Boa tarde");
    expect(saudacao(17)).toBe("Boa tarde");
  });

  it("resto é boa noite (18+, madrugada e meia-noite)", () => {
    expect(saudacao(18)).toBe("Boa noite");
    expect(saudacao(4)).toBe("Boa noite");
    expect(saudacao(0)).toBe("Boa noite");
  });
});

describe("horaEmSaoPaulo", () => {
  it("resolve a hora local de São Paulo independente do TZ do runner", () => {
    // Arrange: instante fixado no offset de SP (UTC-3, sem DST desde 2019)
    const tarde = new Date("2026-06-12T15:30:00-03:00");

    // Act + Assert
    expect(horaEmSaoPaulo(tarde)).toBe(15);
  });

  it("meia-noite em SP é 0, não 24 (regressão do hourCycle h24)", () => {
    const meiaNoite = new Date("2026-06-12T00:10:00-03:00");
    expect(horaEmSaoPaulo(meiaNoite)).toBe(0);
  });
});

describe("diasAguardando / labelEspera", () => {
  const agora = new Date("2026-06-12T12:00:00-03:00");

  it("mesmo instante → 0 → chegou hoje", () => {
    expect(diasAguardando(agora, agora)).toBe(0);
    expect(labelEspera(0)).toBe("chegou hoje");
  });

  it("25h atrás → 1 → singular", () => {
    const ontem = new Date(agora.getTime() - 25 * 60 * 60 * 1000);
    expect(diasAguardando(ontem, agora)).toBe(1);
    expect(labelEspera(1)).toBe("aguarda há 1 dia");
  });

  it("aberta ontem à noite, vista hoje cedo (<24h corridas) → 1 dia-calendário", () => {
    // 15h decorridas, mas o dia civil em SP já virou — não pode ser "chegou hoje"
    const ontemANoite = new Date("2026-06-11T18:00:00-03:00");
    const hojeCedo = new Date("2026-06-12T09:00:00-03:00");
    expect(diasAguardando(ontemANoite, hojeCedo)).toBe(1);
  });

  it("dia já virou em UTC mas ainda é o mesmo dia civil em SP → 0", () => {
    const noite = new Date("2026-06-11T22:00:00-03:00"); // 01:00Z do dia 12
    const maisTarde = new Date("2026-06-11T23:30:00-03:00");
    expect(diasAguardando(noite, maisTarde)).toBe(0);
  });

  it("10 dias atrás → plural", () => {
    const dezDias = new Date(agora.getTime() - 10 * 86_400_000);
    expect(diasAguardando(dezDias, agora)).toBe(10);
    expect(labelEspera(10)).toBe("aguarda há 10 dias");
  });

  it("createdAt no futuro (clock skew) → 0, nunca negativo", () => {
    const futuro = new Date(agora.getTime() + 3 * 86_400_000);
    expect(diasAguardando(futuro, agora)).toBe(0);
  });
});

describe("fraseEstado", () => {
  it("singular e plural de cidadãos ativos", () => {
    const um = textoDe(fraseEstado({ ativos: 1, triagens: 0, veTriagem: false }));
    const dois = textoDe(fraseEstado({ ativos: 2, triagens: 0, veTriagem: false }));
    expect(um).toContain("1 cidadão ativo nas quatro casas.");
    expect(dois).toContain("2 cidadãos ativos nas quatro casas.");
  });

  it("veTriagem com zero pendências traz o dia em dia", () => {
    const texto = textoDe(fraseEstado({ ativos: 5, triagens: 0, veTriagem: true }));
    expect(texto).toContain("Nenhuma triagem pendente");
  });

  it("uma triagem aguarda (singular)", () => {
    const texto = textoDe(fraseEstado({ ativos: 5, triagens: 1, veTriagem: true }));
    expect(texto).toContain("1 triagem aguarda");
  });

  it("várias triagens aguardam (plural)", () => {
    const texto = textoDe(fraseEstado({ ativos: 5, triagens: 7, veTriagem: true }));
    expect(texto).toContain("7 triagens aguardam");
  });

  it("quem não vê triagem (presidência) não recebe número de triagem", () => {
    const texto = textoDe(fraseEstado({ ativos: 5, triagens: 7, veTriagem: false }));
    expect(texto).not.toContain("triagem");
  });

  it("números são segmentos mono (a page envolve em <strong class=mono>)", () => {
    const segmentos = fraseEstado({ ativos: 42, triagens: 3, veTriagem: true });
    const ativos = segmentos.find((s) => s.t === "42");
    const triagens = segmentos.find((s) => s.t === "3");
    expect(ativos?.mono).toBe(true);
    expect(triagens?.mono).toBe(true);
  });
});

describe("quadroDasCasas", () => {
  // Arrange: só medico tem contagem — o resto deve cair em 0 (atendimento)
  const triagem = { abertas: 7, veTriagem: true };
  const { atendimento, transversais } = quadroDasCasas(new Map([["medico", 12]]), triagem);

  it("atendimento tem as 4 casas na ordem canônica", () => {
    expect(atendimento.map((c) => c.slug)).toEqual([
      "medico",
      "capacitacao",
      "esportivo",
      "recreativo",
    ]);
  });

  it("contagem vem do mapa; casa sem entrada cai em 0", () => {
    expect(atendimento[0]?.metrica).toEqual({ valor: "12", nota: "cidadãos ativos" }); // medico
    expect(atendimento[1]?.metrica).toEqual({ valor: "0", nota: "cidadãos ativos" }); // capacitacao
  });

  it("transversais são poncio e social (ordem de UNIDADE_SLUGS)", () => {
    expect(transversais.map((c) => c.slug)).toEqual(["poncio", "social"]);
  });

  it("poncio nunca tem valor numérico — só leitura executiva", () => {
    const poncio = transversais.find((c) => c.slug === "poncio");
    expect(poncio?.metrica).toEqual({ valor: null, nota: "leitura executiva" });
  });

  it("social com veTriagem mostra as triagens em aberto", () => {
    const social = transversais.find((c) => c.slug === "social");
    expect(social?.metrica).toEqual({ valor: "7", nota: "triagens em aberto" });
  });

  it("social sem veTriagem (presidência) não recebe número que o RBAC dela não vê", () => {
    const { transversais: semTriagem } = quadroDasCasas(new Map(), {
      abertas: 7,
      veTriagem: false,
    });
    const social = semTriagem.find((c) => c.slug === "social");
    expect(social?.metrica).toEqual({ valor: null, nota: "acompanhamento das famílias" });
  });

  it("nome/tagline derivam do mapa canônico UNIDADES (nada hardcoded)", () => {
    for (const linha of [...atendimento, ...transversais]) {
      expect(linha.nome).toBe(UNIDADES[linha.slug].nome);
      expect(linha.tagline).toBe(UNIDADES[linha.slug].tagline ?? "");
    }
  });

  it("href de toda linha é /<slug>", () => {
    for (const linha of [...atendimento, ...transversais]) {
      expect(linha.href).toBe(`/${linha.slug}`);
    }
  });
});
