import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;
let pool: Pool | null = null;
let db: any | null = null;

// Verificar se DATABASE_URL está configurado
if (!process.env.DATABASE_URL) {
  console.warn("⚠️ DATABASE_URL não configurado - funcionalidades de banco desabilitadas");
  // Exportar objetos vazios para evitar erros
  pool = null;
  db = null;
} else {
  try {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle({ client: pool, schema });
    console.log("✅ Conexão com banco de dados estabelecida");
  } catch (error) {
    console.error("❌ Erro ao conectar com banco:", error);
    pool = null;
    db = null;
  }
}

export { pool, db };