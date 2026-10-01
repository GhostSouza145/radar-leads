"use client";

import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";
import { login, setupAdmin, type AuthState } from "./actions";

export function LoginForm({ setup }: { setup: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(setup ? setupAdmin : login, {});

  return (
    <form action={action} className="space-y-4">
      <div>
        <h1 className="text-base font-semibold">{setup ? "Crie a sua conta" : "Entrar"}</h1>
        {setup && (
          <p className="mt-1 text-sm text-muted">
            Primeira vez aqui. Esta será a única conta do app; depois dela o cadastro é fechado.
          </p>
        )}
      </div>
      <div>
        <label className="label" htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Senha</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={setup ? 8 : undefined}
          autoComplete={setup ? "new-password" : "current-password"}
          className="input"
        />
      </div>
      {setup && (
        <div>
          <label className="label" htmlFor="confirm">Confirmar senha</label>
          <input id="confirm" name="confirm" type="password" required autoComplete="new-password" className="input" />
        </div>
      )}
      {state.error && <p className="text-sm text-hot">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending && <LoaderCircle className="size-4 animate-spin" />}
        {setup ? "Criar conta e entrar" : "Entrar"}
      </button>
    </form>
  );
}
