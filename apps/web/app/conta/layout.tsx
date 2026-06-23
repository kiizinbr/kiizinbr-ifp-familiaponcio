import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { iniciaisDe } from "@/lib/iniciais";
import { ShellInterno, type ModuloCasa } from "@/components/casa";

/**
 * "Minha conta" é cross-cutting: qualquer perfil logado acessa. O Shell precisa
 * de um módulo (para a cor/tema e o rail), então derivamos um "contexto
 * principal" do usuário pelos perfis e, em último caso, pela 1ª unidade.
 */
const MODULO_POR_PERFIL: Record<string, ModuloCasa> = {
  SUPER_ADMIN: "admin",
  PRESIDENCIA: "presidencia",
  SERVICO_SOCIAL: "servico-social",
};

const MODULO_POR_UNIDADE: Record<string, ModuloCasa> = {
  medico: "medico",
  capacitacao: "capacitacao",
  educacional: "educacional",
  esportivo: "esportivo",
};

const CARGO_POR_MODULO: Record<ModuloCasa, string> = {
  presidencia: "Presidência",
  medico: "Centro Médico",
  capacitacao: "Capacitação",
  educacional: "Educacional",
  esportivo: "Esportivo",
  "servico-social": "Serviço Social",
  admin: "Administração",
};

function moduloDaSessao(perfis: string[], unidadeSlugs: string[]): ModuloCasa {
  for (const p of perfis) {
    if (MODULO_POR_PERFIL[p]) return MODULO_POR_PERFIL[p];
  }
  for (const slug of unidadeSlugs) {
    if (MODULO_POR_UNIDADE[slug]) return MODULO_POR_UNIDADE[slug];
  }
  return "admin";
}

export default async function ContaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login?callbackUrl=/conta");
  }

  const perfis = session.perfis ?? [];
  const slugs = (session.unidades ?? []).map((u) => u.slug);
  const modulo = moduloDaSessao(perfis, slugs);
  const nome = session.user?.name ?? session.user?.email ?? "Usuário";

  return (
    <ShellInterno
      modulo={modulo}
      user={nome}
      cargo={CARGO_POR_MODULO[modulo]}
      iniciais={iniciaisDe(nome)}
      habilitadas={[]}
    >
      {children}
    </ShellInterno>
  );
}
