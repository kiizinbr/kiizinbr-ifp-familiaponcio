import { notFound } from "next/navigation";
import { UnidadeLoginShell } from "@/components/unidade-login-shell";
import { unidadeLoginAction } from "./login-action";
import { unidadeFromSlug } from "@/lib/unidades";

export default async function UnidadeLoginPage({
  params,
}: {
  params: Promise<{ unidade: string }>;
}) {
  const { unidade: slug } = await params;
  const unidade = unidadeFromSlug(slug);
  if (!unidade) notFound();

  const boundAction = unidadeLoginAction.bind(null, slug);

  return <UnidadeLoginShell unidade={unidade} loginAction={boundAction} />;
}
