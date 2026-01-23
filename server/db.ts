

import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import pg from 'pg';
import dns from 'dns';

const { Pool } = pg;

// Use InstanceType to extract the Pool type from the class constructor value
let pool: InstanceType<typeof Pool> | null = null;
let db: any | null = null;

function initializeDefault() {
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
      console.log("✅ Conexão com banco de dados estabelecida (Configuração inicial)");
    } catch (error) {
      console.error("❌ Erro ao conectar com banco:", error);
      pool = null;
      db = null;
    }
  }
}

// Inicialização padrão imediata (para scripts e compatibilidade)
initializeDefault();

/**
 * Reinicializa a conexão com o banco forçando a resolução IPv4
 * Isso corrige o erro ENETUNREACH em ambientes como Render que podem tentar IPv6 por padrão
 */
export async function initDb() {
  if (!process.env.DATABASE_URL) return;

  try {
    const dbUrl = new URL(process.env.DATABASE_URL);
    const hostname = dbUrl.hostname;

    console.log(`🔍 Resolvendo DNS para host do banco: ${hostname}`);
    const addresses = await dns.promises.resolve4(hostname);

    if (addresses && addresses.length > 0) {
      const ip = addresses[0];
      console.log(`✅ IP resolvido: ${ip}. Reconfigurando pool...`);

      // Substitui o hostname pelo IP na string de conexão
      // Nota: URL.toString() pode codificar caracteres, então fazemos substituição cuidadosa
      const newUrl = process.env.DATABASE_URL.replace(hostname, ip);

      // Encerra pool anterior se existir
      if (pool) {
        await pool.end().catch(err => console.error("Erro ao fechar pool antigo:", err));
      }

      pool = new Pool({
        connectionString: newUrl,
      });
      db = drizzle(pool, { schema });
      console.log("✅ Conexão com banco de dados re-estabelecida com IPv4 explícito");
    }
  } catch (error) {
    console.warn(`⚠️ Falha ao resolver IPv4 explícito para o banco (usando configuração padrão): ${error}`);
    // Mantém a configuração padrão inicializada anteriormente se falhar
  }
}

export { pool, db };