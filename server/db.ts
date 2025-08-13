import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Verificar se DATABASE_URL está configurado
if (!process.env.DATABASE_URL) {
  console.warn("⚠️ DATABASE_URL não configurado - funcionalidades de banco desabilitadas");
  // Exportar objetos vazios para evitar erros
  export const pool = null;
  export const db = null;
} else {
  try {
    export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    export const db = drizzle({ client: pool, schema });
    console.log("✅ Conexão com banco de dados estabelecida");
  } catch (error) {
    console.error("❌ Erro ao conectar com banco:", error);
    export const pool = null;
    export const db = null;
  }
}