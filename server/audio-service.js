import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AudioService {
  constructor() {
    // Usar OpenRouter se disponível, senão OpenAI direto
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENROUTER_API_KEY 
      ? 'https://openrouter.ai/api/v1'
      : undefined;
    
    if (!apiKey) {
      console.log('⚠️ AudioService não disponível - configure OPENROUTER_API_KEY ou OPENAI_API_KEY');
      this.available = false;
      return;
    }
    
    this.openai = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL,
    });
    
    this.uploadsDir = path.join(__dirname, '..', 'uploads');
    this.ensureUploadsDir();
    this.available = true;
    
    console.log('🎤 AudioService inicializado com sucesso');
  }

  ensureUploadsDir() {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  // Verificar se o serviço está disponível
  isAvailable() {
    return this.available;
  }

  // Função para transcrever áudio (Speech-to-Text)
  async transcribeAudio(audioBuffer, filename) {
    try {
      if (!this.available) {
        throw new Error('AudioService não disponível');
      }
      
      console.log('🎤 Iniciando transcrição de áudio...');
      
      // Salvar o arquivo temporariamente
      const tempPath = path.join(this.uploadsDir, filename);
      fs.writeFileSync(tempPath, audioBuffer);
      
      // Transcrever usando OpenAI Whisper
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tempPath),
        model: 'whisper-1',
        language: 'pt', // Português
        response_format: 'text'
      });
      
      // Limpar arquivo temporário
      fs.unlinkSync(tempPath);
      
      console.log(`✅ Transcrição concluída: "${transcription}"`);
      return transcription;
      
    } catch (error) {
      console.error('❌ Erro na transcrição:', error);
      throw error;
    }
  }

  // Função para gerar áudio (Text-to-Speech)
  async generateAudio(text, filename) {
    try {
      if (!this.available) {
        throw new Error('AudioService não disponível');
      }
      
      console.log('🔊 Iniciando geração de áudio...');
      
      const speechFile = path.join(this.uploadsDir, filename);
      
      const mp3 = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: 'alloy', // Voz em português
        input: text,
      });
      
      const buffer = Buffer.from(await mp3.arrayBuffer());
      fs.writeFileSync(speechFile, buffer);
      
      console.log(`✅ Áudio gerado: ${speechFile}`);
      return speechFile;
      
    } catch (error) {
      console.error('❌ Erro na geração de áudio:', error);
      throw error;
    }
  }

  // Função para processar mensagem de voz do Telegram
  async processVoiceMessage(telegramBot, chatId, fileId) {
    try {
      console.log('🎤 Processando mensagem de voz...');
      console.log(`📁 File ID: ${fileId}`);
      
      // Baixar o arquivo de áudio
      console.log('📥 Baixando arquivo de áudio...');
      const file = await telegramBot.getFile(fileId);
      console.log(`📁 File info:`, file);
      
      const audioUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
      console.log(`🔗 Audio URL: ${audioUrl}`);
      
      // Fazer download do arquivo
      console.log('⬇️ Fazendo download do arquivo...');
      const response = await fetch(audioUrl);
      console.log(`📊 Response status: ${response.status}`);
      
      if (!response.ok) {
        throw new Error(`Erro ao baixar arquivo: ${response.status}`);
      }
      
      const audioBuffer = await response.arrayBuffer();
      console.log(`📦 Audio buffer size: ${audioBuffer.byteLength} bytes`);
      
      // Transcrever o áudio
      console.log('🎵 Iniciando transcrição...');
      const transcription = await this.transcribeAudio(Buffer.from(audioBuffer), `voice_${Date.now()}.ogg`);
      
      return transcription;
      
    } catch (error) {
      console.error('❌ Erro ao processar mensagem de voz:', error);
      console.error('❌ Error details:', error.message);
      throw error;
    }
  }

  // Função para enviar resposta em áudio
  async sendAudioResponse(telegramBot, chatId, text) {
    try {
      console.log('🔊 Enviando resposta em áudio...');
      
      // Gerar áudio da resposta
      const audioFile = await this.generateAudio(text, `response_${Date.now()}.mp3`);
      
      // Enviar áudio para o Telegram
      await telegramBot.sendAudio(chatId, audioFile, {
        caption: text,
        title: 'Resposta do Zelar Bot',
        performer: 'Zelar Bot'
      });
      
      // Limpar arquivo temporário
      fs.unlinkSync(audioFile);
      
      console.log('✅ Resposta em áudio enviada!');
      
    } catch (error) {
      console.error('❌ Erro ao enviar resposta em áudio:', error);
      // Fallback: enviar como texto
      await telegramBot.sendMessage(chatId, text, { parse_mode: 'HTML' });
    }
  }
}

export default AudioService;
