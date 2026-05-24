/**
 * Auto-complete de endereço via CEP (BrasilAPI v1).
 *
 * Decisão §0.3 do Plano 3 (FECHADA em 2026-05-24):
 * - Recepção digita CEP no form → BrasilAPI traz logradouro/bairro/cidade/UF
 * - Sem fallback pra ViaCEP por agora (BrasilAPI é mais confiável + tem dados unificados)
 * - Sem geocoding lat/long no MVP
 */

const BRASILAPI_URL = "https://brasilapi.com.br/api/cep/v1";

export interface CepAddress {
  cep: string; // 8 dígitos normalizados
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string; // 2 letras
}

/** Remove tudo que não é dígito. */
export function normalizeCep(input: string): string {
  return input.replace(/\D/g, "");
}

/** Formata 8 dígitos no padrão `00000-000`. */
export function formatCep(input: string): string {
  const digits = normalizeCep(input);
  if (digits.length !== 8) return input;
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

/**
 * Busca endereço pelo CEP via BrasilAPI v1.
 * - Cache do Next.js (`force-cache`) por 1 dia pra mesmo CEP não bater API várias vezes
 * - Retorna null se CEP inválido ou não encontrado (404)
 * - NÃO lança em erro de rede — retorna null pra UI lidar graciosamente
 */
export async function fetchAddressFromCep(input: string): Promise<CepAddress | null> {
  const cep = normalizeCep(input);
  if (cep.length !== 8) return null;

  try {
    const response = await fetch(`${BRASILAPI_URL}/${cep}`, {
      // Cache por 1 dia
      next: { revalidate: 86_400 },
    });
    if (!response.ok) return null;

    const data = (await response.json()) as {
      cep: string;
      state: string;
      city: string;
      neighborhood: string;
      street: string;
    };

    return {
      cep: data.cep ?? cep,
      logradouro: data.street ?? "",
      bairro: data.neighborhood ?? "",
      cidade: data.city ?? "",
      uf: data.state ?? "",
    };
  } catch {
    return null;
  }
}
