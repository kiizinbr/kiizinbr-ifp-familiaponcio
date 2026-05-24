import { signIn } from "@/lib/auth";

export default function LoginPage() {
  return (
    <main className="min-h-screen grid place-items-center bg-slate-50">
      <form
        action={async (formData) => {
          "use server";
          await signIn("credentials", {
            email: formData.get("email"),
            password: formData.get("password"),
            redirectTo: "/app",
          });
        }}
        className="w-full max-w-sm bg-white p-8 rounded-xl shadow"
      >
        <h1 className="text-2xl font-semibold mb-6">IFP Connect</h1>
        <label className="block mb-3">
          <span className="block text-sm mb-1">E-mail</span>
          <input
            name="email"
            type="email"
            required
            className="w-full border rounded px-3 py-2"
          />
        </label>
        <label className="block mb-6">
          <span className="block text-sm mb-1">Senha</span>
          <input
            name="password"
            type="password"
            required
            className="w-full border rounded px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="w-full bg-slate-900 text-white rounded py-2"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
