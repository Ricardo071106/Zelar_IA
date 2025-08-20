import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

class AudioService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async transcribeAudio(audioBuffer, filename = 'audio.ogg') {
    try {
      console.log('🎤 Processando áudio...');
      
      // Salvar o buffer temporariamente
      const tempPath = path.join(process.cwd(), 'temp', filename);
      const tempDir = path.dirname(tempPath);
      
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      fs.writeFileSync(tempPath, audioBuffer);
      
      // Transcrever com OpenAI Whisper
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
      throw error;
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