import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import pg from 'pg';

const { Pool } = pg;

// Use InstanceType to extract the Pool type from the class constructor value
let pool: InstanceType<typeof Pool> | null = null;
let db: any | null = null;

// Verificar se DATABASE_URL está configurado
if (!process.env.DATABASE_URL) {
  console.warn("⚠️ DATABASE_URL não configurado - funcionalidades de banco desabilitadas");
  // Exportar objetos vazios para evitar erros
  pool = null;
  db = null;
} else {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    db = drizzle(pool, { schema });
    console.log("✅ Conexão com banco de dados estabelecida");
  } catch (error) {
    console.error("❌ Erro ao conectar com banco:", error);
    pool = null;
    db = null;
  }
}

export { pool, db };