import { signIn } from "@/lib/auth";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50">
      <form
        action={async (formData) => {
          "use server";
          await signIn("credentials", {
            email: formData.get("email"),
            password: formData.get("password"),
            redirectTo: "/app",
          });
        }}
        className="w-full max-w-sm rounded-xl bg-white p-8 shadow"
      >
        <h1 className="mb-6 text-2xl font-semibold">IFP Connect</h1>
        <label className="mb-3 block">
          <span className="mb-1 block text-sm">E-mail</span>
          <input name="email" type="email" required className="w-full rounded border px-3 py-2" />
        </label>
        <label className="mb-6 block">
          <span className="mb-1 block text-sm">Senha</span>
          <input
            name="password"
            type="password"
            required
            className="w-full rounded border px-3 py-2"
          />
        </label>
        <button type="submit" className="w-full rounded bg-slate-900 py-2 text-white">
          Entrar
        </button>
      </form>
    </main>
  );
}
