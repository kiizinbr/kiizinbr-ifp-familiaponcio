import { auth } from "@/lib/auth";

export default async function AppHome() {
  const session = await auth();
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold">Olá, {session?.user?.name ?? session?.user?.email}</h1>
      <p className="mt-2 text-slate-600">Sessão ativa no IFP Connect.</p>
    </main>
  );
}
