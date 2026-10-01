// Aplica supabase/schema.sql no banco. Uso: npm run db:migrate
// Lê a conexão de POSTGRES_URL_NON_POOLING (ou POSTGRES_URL) no .env.local.
import { readFileSync } from "node:fs";
import pg from "pg";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
}

const raw = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
if (!raw) {
  console.error("Faltou POSTGRES_URL_NON_POOLING no .env.local (rode: npx vercel env pull .env.local).");
  process.exit(1);
}

// O `sslmode` da URL faria o driver exigir a cadeia completa; a conexão segue cifrada.
const url = new URL(raw);
url.searchParams.delete("sslmode");

const client = new pg.Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(readFileSync("supabase/schema.sql", "utf8"));
  const { rows } = await client.query(
    "select table_name from information_schema.tables where table_schema = 'public' order by 1",
  );
  console.log("Schema aplicado. Tabelas:", rows.map((r) => r.table_name).join(", "));
} finally {
  await client.end();
}
