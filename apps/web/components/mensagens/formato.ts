/** Helpers de formatação do chat família ↔ instituto (datas em PT-BR). */

export function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[partes.length - 1]?.[0] ?? "")).toUpperCase();
}

export function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

export function horaCurta(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mesmaData(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Separador de dia dentro da thread: Hoje · Ontem · 3 de junho (de 2025). */
export function rotuloDia(iso: string) {
  const data = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);

  if (mesmaData(data, hoje)) return "Hoje";
  if (mesmaData(data, ontem)) return "Ontem";
  return data.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    ...(data.getFullYear() !== hoje.getFullYear() ? { year: "numeric" } : {}),
  });
}

/** Carimbo compacto na lista de conversas: HH:mm hoje, senão dd/mm. */
export function quandoCompacto(iso: string) {
  const data = new Date(iso);
  if (mesmaData(data, new Date())) return horaCurta(iso);
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
