/**
 * Sistema de aprendizado que coleta padrões do Claude para melhorar o parsing local
 * Quando o Claude interpretar algo corretamente, salvamos o padrão para uso futuro
 */

import { db } from '../db';
import { learningPatterns } from '../../shared/schema';
import { eq, desc, and, lt } from 'drizzle-orm';

interface LearningPattern {
  id: number;
  originalText: string;
  extractedTitle: string;
  detectedTime: string; // formato HH:MM
  detectedDate: string; // YYYY-MM-DD
  confidence: number; // 0-1, baseado em quantas vezes funcionou
  createdAt: Date;
  usageCount: number;
}

// Cache em memória para padrões mais usados
let patternCache: LearningPattern[] = [];
let cacheLastUpdated = 0;

/**
 * Salva um padrão bem-sucedido do Claude para aprendizado futuro
 */
export async function saveSuccessfulPattern(
  originalText: string,
  claudeTitle: string,
  claudeHour: number,
  claudeMinute: number,
  claudeDate: string
): Promise<void> {
  try {
    const timeString = `${claudeHour.toString().padStart(2, '0')}:${claudeMinute.toString().padStart(2, '0')}`;
    
    // Verificar se já existe um padrão similar
    const existingPattern = await db.select()
      .from(learningPatterns)
      .where(and(
        eq(learningPatterns.originalText, originalText.toLowerCase()),
        eq(learningPatterns.detectedTime, timeString)
      ))
      .limit(1);

    if (existingPattern.length > 0) {
      // Aumentar confiança e contador de uso
      await db.update(learningPatterns)
        .set({ 
          usageCount: existingPattern[0].usageCount + 1,
          confidence: Math.min(existingPattern[0].confidence + 10, 100)
        })
        .where(eq(learningPatterns.id, existingPattern[0].id));
    } else {
      // Criar novo padrão
      await db.insert(learningPatterns).values({
        originalText: originalText.toLowerCase(),
        extractedTitle: claudeTitle,
        detectedTime: timeString,
        detectedDate: claudeDate,
        confidence: 80,
        usageCount: 1
      });
    }

    // Limpar cache para forçar reload
    cacheLastUpdated = 0;
    console.log(`📚 Padrão aprendido: "${originalText}" → ${claudeTitle} às ${timeString}`);

  } catch (error) {
    console.error('Erro ao salvar padrão de aprendizado:', error);
  }
}

/**
 * Busca padrões similares aprendidos para melhorar parsing local
 */
export async function findSimilarPattern(userText: string): Promise<{
  title: string;
  hour: number;
  minute: number;
  date: string;
  confidence: number;
} | null> {
  try {
    // Atualizar cache se necessário
    const now = Date.now();
    if (now - cacheLastUpdated > 300000) { // 5 minutos
      patternCache = await db.query.learningPatterns
        ?.orderBy(desc(db.query.learningPatterns.confidence), desc(db.query.learningPatterns.usageCount))
        .limit(100) || [];
      cacheLastUpdated = now;
    }

    const userTextLower = userText.toLowerCase();
    
    // Buscar padrões similares com algoritmo simples de similaridade
    for (const pattern of patternCache) {
      const similarity = calculateTextSimilarity(userTextLower, pattern.originalText);
      
      if (similarity > 0.7 && pattern.confidence > 0.6) {
        const [hour, minute] = pattern.detectedTime.split(':').map(Number);
        
        console.log(`🎯 Padrão similar encontrado: "${pattern.originalText}" (similaridade: ${similarity.toFixed(2)})`);
        
        return {
          title: pattern.extractedTitle,
          hour,
          minute,
          date: pattern.detectedDate,
          confidence: pattern.confidence * similarity
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Erro ao buscar padrões similares:', error);
    return null;
  }
}

/**
 * Calcula similaridade entre dois textos (algoritmo simples)
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = text1.split(' ').filter(w => w.length > 2);
  const words2 = text2.split(' ').filter(w => w.length > 2);
  
  let matches = 0;
  for (const word1 of words1) {
    if (words2.some(word2 => 
      word1.includes(word2) || 
      word2.includes(word1) || 
      levenshteinDistance(word1, word2) <= 1
    )) {
      matches++;
    }
  }
  
  return matches / Math.max(words1.length, words2.length);
}

/**
 * Distância de Levenshtein simples
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Limpa padrões antigos ou com baixa confiança
 */
export async function cleanupOldPatterns(): Promise<void> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    await db.delete(db.query.learningPatterns)
      .where(and(
        eq(db.query.learningPatterns.confidence, 0.3),
        eq(db.query.learningPatterns.createdAt, thirtyDaysAgo)
      ));
      
    console.log('🧹 Padrões antigos limpos');
  } catch (error) {
    console.error('Erro ao limpar padrões:', error);
  }
}