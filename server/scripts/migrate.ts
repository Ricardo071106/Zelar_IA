/**
 * Script para executar migrations usando Drizzle
 * Sincroniza o schema com o banco de dados
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from '../../shared/schema.js';

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não configurado no arquivo .env');
  process.exit(1);
}

async function runMigrations() {
  console.log('🔧 Executando migrations do Drizzle...\n');
  
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle({ client: pool, schema });
  
  try {
    console.log('📡 Conectando ao banco de dados...');
    await pool.query('SELECT NOW()');
    console.log('✅ Conexão estabelecida!\n');
    
    console.log('📋 Aplicando migrations...');
    await migrate(db, { migrationsFolder: './migrations' });
    console.log('✅ Migrations aplicadas com sucesso! 🎉\n');
    
    console.log('💡 Agora você pode iniciar o servidor com: npm run start');
    
  } catch (error) {
    console.error('\n❌ Erro ao executar migrations:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
