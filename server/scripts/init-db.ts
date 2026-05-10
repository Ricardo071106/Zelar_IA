/**
 * Script de inicialização do banco de dados
 * Cria todas as tabelas necessárias para o projeto Zelar
 */

import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';
import ws from 'ws';
import { neonConfig } from '@neondatabase/serverless';

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não configurado no arquivo .env');
  process.exit(1);
}

async function initDatabase() {
  console.log('🔧 Iniciando configuração do banco de dados...\n');
  
  const pool = new Pool({ connectionString: DATABASE_URL });
  
  try {
    // Testar conexão
    console.log('📡 Testando conexão com o banco...');
    await pool.query('SELECT NOW()');
    console.log('✅ Conexão estabelecida com sucesso!\n');
    
    // Criar tabela users
    console.log('📋 Criando tabela "users"...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        telegram_id TEXT UNIQUE,
        name TEXT,
        email TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    console.log('✅ Tabela "users" criada!\n');
    
    // Criar tabela events
    console.log('📋 Criando tabela "events"...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP,
        location TEXT,
        is_all_day BOOLEAN DEFAULT false,
        calendar_id TEXT,
        conference_link TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        raw_data JSONB
      )
    `);
    console.log('✅ Tabela "events" criada!\n');

    // Criar tabela reminders
    console.log('📋 Criando tabela "reminders"...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reminders (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        channel VARCHAR(20) NOT NULL,
        message TEXT,
        send_at TIMESTAMP NOT NULL,
        sent BOOLEAN DEFAULT false NOT NULL,
        sent_at TIMESTAMP,
        is_default BOOLEAN DEFAULT false NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    console.log('✅ Tabela "reminders" criada!\n');

    // Garantir colunas de reminders (idempotente)
    console.log('🔎 Garantindo colunas da tabela "reminders"...');
    await pool.query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS send_at TIMESTAMP;`);
    await pool.query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS sent BOOLEAN DEFAULT false NOT NULL;`);
    await pool.query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP;`);
    await pool.query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false NOT NULL;`);
    await pool.query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS reminder_time INTEGER DEFAULT 12;`);
    await pool.query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();`);
    await pool.query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`);
    await pool.query(`
      ALTER TABLE reminders
      ALTER COLUMN reminder_time DROP DEFAULT,
      ALTER COLUMN reminder_time TYPE INTEGER USING 12
    `);
    await pool.query(`ALTER TABLE reminders ALTER COLUMN created_at SET DEFAULT NOW();`);
    await pool.query(`ALTER TABLE reminders ALTER COLUMN updated_at SET DEFAULT NOW();`);
    await pool.query(`UPDATE reminders SET reminder_time = 12 WHERE reminder_time IS NULL;`);
    await pool.query(`ALTER TABLE reminders ALTER COLUMN reminder_time SET NOT NULL;`);
    await pool.query(`ALTER TABLE reminders ALTER COLUMN reminder_time SET DEFAULT 12;`);
    console.log('✅ Colunas de reminders OK!\n');

    // Garantir colunas de identificação do canal (idempotente)
    await pool.query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS channel VARCHAR(20);`);
    await pool.query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS message TEXT;`);
    await pool.query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS user_id INTEGER;`);
    await pool.query(`ALTER TABLE reminders ALTER COLUMN channel SET NOT NULL;`);
    await pool.query(`ALTER TABLE reminders ALTER COLUMN user_id SET NOT NULL;`);

    // Criar índices para performance
    console.log('📋 Criando índices na tabela "events"...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
      CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
    `);
    console.log('✅ Índices criados!\n');

    console.log('📋 Criando índices na tabela "reminders"...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_reminders_event_id ON reminders(event_id);
      CREATE INDEX IF NOT EXISTS idx_reminders_send_at ON reminders(send_at);
      CREATE INDEX IF NOT EXISTS idx_reminders_user_channel ON reminders(user_id, channel);
    `);
    console.log('✅ Índices de reminders criados!\n');
    
    // Criar tabela user_settings
    console.log('📋 Criando tabela "user_settings"...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        notifications_enabled BOOLEAN DEFAULT true,
        reminder_times INTEGER[],
        calendar_provider VARCHAR(20),
        google_tokens TEXT,
        apple_tokens TEXT,
        language VARCHAR(10) DEFAULT 'pt-BR',
        time_zone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE(user_id)
      )
    `);
    console.log('✅ Tabela "user_settings" criada!\n');
    
    // Verificar tabelas criadas
    console.log('🔍 Verificando tabelas criadas...');
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log('\n📊 Tabelas no banco de dados:');
    result.rows.forEach((row: any) => {
      console.log(`   ✅ ${row.table_name}`);
    });
    
    // Contar registros em cada tabela
    console.log('\n[STATS] Contagem de registros:');
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    const eventCount = await pool.query('SELECT COUNT(*) FROM events');
    const settingsCount = await pool.query('SELECT COUNT(*) FROM user_settings');
    const remindersCount = await pool.query('SELECT COUNT(*) FROM reminders');
    
    console.log(`   Users: ${userCount.rows[0].count}`);
    console.log(`   Events: ${eventCount.rows[0].count}`);
    console.log(`   Settings: ${settingsCount.rows[0].count}`);
    console.log(`   Reminders: ${remindersCount.rows[0].count}`);
    
    console.log('\n✅ Banco de dados inicializado com sucesso! 🎉');
    console.log('\n💡 Agora você pode iniciar o servidor com: npm run start');
    
  } catch (error) {
    console.error('\n❌ Erro ao inicializar banco de dados:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Executar script
initDatabase();
