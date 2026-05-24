import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50">
      <LoginForm error={params.error} />
    </main>
  );
}
