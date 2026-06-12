import clsx from "clsx";
import { LoginForm } from "./login-form";
import { TemaUnidade } from "@/components/tema-unidade";
import { temaCasaDoSlug } from "@/lib/tema-casa";
import { unidadeFromSlug } from "@/lib/unidades";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; unidade?: string }>;
}) {
  const params = await searchParams;
  // ?unidade=<slug> tematiza o login (vindo de /acesso). Slug inválido/ausente
  // → tema null (sem data-unit) e o login fica neutro, como sempre foi.
  const tema = temaCasaDoSlug(params.unidade);
  const unidade = tema ? unidadeFromSlug(tema) : null;
  return (
    <TemaUnidade tema={tema}>
      <main
        className={clsx(
          "grid min-h-screen place-items-center",
          tema ? "bg-background" : "bg-slate-50",
        )}
      >
        <LoginForm
          error={params.error}
          unidade={unidade ? { slug: unidade.slug, nome: unidade.nome } : undefined}
        />
      </main>
    </TemaUnidade>
  );
}
