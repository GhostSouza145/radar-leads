"use server";

import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { needsSetup } from "@/lib/setup";

export interface AuthState {
  error?: string;
}

function credentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = credentials(formData);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "E-mail ou senha incorretos." };
  redirect("/");
}

export async function setupAdmin(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = credentials(formData);
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Informe um e-mail válido." };
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  if (password !== String(formData.get("confirm") ?? "")) return { error: "As senhas não conferem." };
  if (!(await needsSetup())) return { error: "Este app já tem um dono. Entre com a sua conta." };

  const { error } = await createAdminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) return { error: `Não foi possível criar a conta: ${error.message}` };

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return { error: "Conta criada. Entre com seu e-mail e senha." };
  redirect("/configuracoes?bemvindo=1");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
