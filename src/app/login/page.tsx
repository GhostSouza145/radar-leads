import { Radar } from "lucide-react";
import { isSupabaseConfigured, SUPABASE_SERVICE_KEY } from "@/lib/supabase/env";
import { needsSetup } from "@/lib/setup";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const configured = isSupabaseConfigured && Boolean(SUPABASE_SERVICE_KEY);
  const setup = configured ? await needsSetup() : false;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-lg font-semibold">
          <Radar className="size-6 text-accent" />
          Radar de Leads
        </div>
        <div className="card p-6">
          {configured ? (
            <LoginForm setup={setup} />
          ) : (
            <p className="text-sm text-muted">
              O banco de dados ainda não foi conectado. Defina as variáveis do Supabase no projeto
              da Vercel e faça um novo deploy.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
