import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

class AudioService {
  constructor() {
    this.openai = null;
    this.isAvailable = false;
    
    // Tentar OpenRouter primeiro (mais barato)
    if (process.env.OPENROUTER_API_KEY) {
      try {
        this.openai = new OpenAI({
          apiKey: process.env.OPENROUTER_API_KEY,
          baseURL: 'https://openrouter.ai/api/v1',
          defaultHeaders: {
            'HTTP-Referer': 'https://zelar-ia.onrender.com',
            'X-Title': 'Zelar - Assistente de Agendamento'
          }
        });
        this.isAvailable = true;
        console.log('✅ AudioService inicializado com OpenRouter');
      } catch (error) {
        console.log('⚠️ AudioService não disponível - OpenRouter não configurado');
      }
    }
    // Fallback para OpenAI direto
    else if (process.env.OPENAI_API_KEY) {
      try {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        this.isAvailable = true;
        console.log('✅ AudioService inicializado com OpenAI');
      } catch (error) {
        console.log('⚠️ AudioService não disponível - OpenAI não configurado');
      }
    } else {
      console.log('⚠️ AudioService não disponível - OPENROUTER_API_KEY ou OPENAI_API_KEY não configuradas');
    }
  }

  async transcribeAudio(audioBuffer, filename = 'audio.ogg') {
    if (!this.isAvailable || !this.openai) {
      throw new Error('AudioService não está disponível - OpenAI/OpenRouter não configurado');
    }
    
    try {
      console.log('🎤 Processando áudio...');
      
      // Salvar o buffer temporariamente
      const tempPath = path.join(process.cwd(), 'temp', filename);
      const tempDir = path.dirname(tempPath);
      
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      fs.writeFileSync(tempPath, audioBuffer);
      
      console.log('🔧 Usando Whisper para transcrição...');
      
      // Transcrever com Whisper (funciona tanto no OpenRouter quanto OpenAI)
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tempPath),
        model: "whisper-1",
        language: "pt",
        response_format: "text"
      });
      
      // Limpar arquivo temporário
      fs.unlinkSync(tempPath);
      
      console.log('✅ Áudio transcrito:', transcription);
      return transcription;
      
    } catch (error) {
      console.error('❌ Erro ao transcrever áudio:', error);
      throw error;
    }
  }

  async processVoiceMessage(audioBuffer, platform = 'whatsapp') {
    if (!this.isAvailable) {
      return {
        original: 'Serviço de áudio não disponível',
        processed: 'Serviço de áudio não disponível',
        platform: platform,
        error: 'AudioService não configurado'
      };
    }
    
    try {
      const transcription = await this.transcribeAudio(audioBuffer);
      
      // Processar o texto transcrito
      const processedText = this.cleanTranscription(transcription);
      
      return {
        original: transcription,
        processed: processedText,
        platform: platform
      };
      
    } catch (error) {
      console.error('❌ Erro ao processar mensagem de voz:', error);
      return {
        original: 'Erro ao processar áudio',
        processed: 'Erro ao processar áudio',
        platform: platform,
        error: error.message
      };
    }
  }

  cleanTranscription(text) {
    // Limpar e normalizar o texto transcrito
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // Remover espaços extras
      .replace(/[^\w\sàáâãéêíóôõúç]/g, ''); // Manter apenas letras, números e espaços
  }
}

export default AudioService; 