import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function alterTable() {
  try {
    // Verificar se a coluna já existe
    const checkColumn = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_settings' 
      AND column_name = 'notifications_enabled'
    `);
    
    if (checkColumn.length === 0) {
      // Adicionar a coluna se não existir
      await db.execute(sql`
        ALTER TABLE user_settings 
        ADD COLUMN notifications_enabled BOOLEAN DEFAULT true
      `);
      console.log("Coluna 'notifications_enabled' adicionada com sucesso à tabela 'user_settings'");
    } else {
      console.log("Coluna 'notifications_enabled' já existe na tabela 'user_settings'");
    }
    
    console.log("Banco de dados atualizado com sucesso!");
  } catch (error) {
    console.error("Erro ao atualizar o banco de dados:", error);
  } finally {
    process.exit(0);
  }
}

alterTable();