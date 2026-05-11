import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";

interface ChatMessage {
  type: string;
  text: string;
  title?: string;
  day?: string;
  time?: string;
  description?: string;
}

interface ChatDemoProps {
  step: number;
}

export default function ChatDemo({ step }: ChatDemoProps) {
  const chatRef = useRef<HTMLDivElement>(null);
  
  // Rola para o final do chat quando novas mensagens são adicionadas
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [step]);

  const chatDemo: ChatMessage[][] = [
    [
      {
        type: "bot",
        text: "👋 Olá! Sou o Zelar. Pode dizer sua aula em português — aluno, matéria, dia e horário.",
      },
    ],
    [
      {
        type: "bot",
        text: "👋 Olá! Sou o Zelar. Pode dizer sua aula em português — aluno, matéria, dia e horário.",
      },
      { type: "user", text: "Aula de violão com o Lucas sábado às 10h no estúdio" },
      { type: "thinking", text: "Processando..." },
    ],
    [
      {
        type: "bot",
        text: "👋 Olá! Sou o Zelar. Pode dizer sua aula em português — aluno, matéria, dia e horário.",
      },
      { type: "user", text: "Aula de violão com o Lucas sábado às 10h no estúdio" },
      {
        type: "bot",
        text: "✅ Aula registrada na sua agenda!\n\nResumo:",
        title: "Violão · Lucas",
        day: format(new Date(new Date().setDate(new Date().getDate() + 1)), "EEEE, dd 'de' MMMM", { locale: ptBR }),
        time: "10:00",
        description: "Local: Estúdio",
      },
    ],
    [
      {
        type: "bot",
        text: "👋 Olá! Sou o Zelar. Pode dizer sua aula em português — aluno, matéria, dia e horário.",
      },
      { type: "user", text: "Aula de violão com o Lucas sábado às 10h no estúdio" },
      {
        type: "bot",
        text: "✅ Aula registrada na sua agenda!\n\nResumo:",
        title: "Violão · Lucas",
        day: format(new Date(new Date().setDate(new Date().getDate() + 1)), "EEEE, dd 'de' MMMM", { locale: ptBR }),
        time: "10:00",
        description: "Local: Estúdio",
      },
      { type: "user", text: "Quais aulas eu tenho amanhã?" },
      {
        type: "bot",
        text: "📅 *Suas aulas para amanhã:*\n\n*Violão · Lucas*\n🕒 10:00\n📍 Estúdio\n\nQuer lembrete no WhatsApp antes da aula?",
      },
    ],
  ];

  // Pega a conversa atual com base no passo
  const currentChat = chatDemo[Math.min(step, chatDemo.length - 1)];

  return (
    <div className="flex flex-col h-[500px] overflow-hidden">
      {/* Cabeçalho do chat */}
      <div className="flex items-center p-3 border-b">
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
          <span className="text-primary-600 text-lg font-semibold">Z</span>
        </div>
        <div className="ml-3">
          <h3 className="font-medium">Zelar</h3>
          <p className="text-xs text-gray-500">Aulas no WhatsApp</p>
        </div>
      </div>
      
      {/* Área de mensagens */}
      <div 
        ref={chatRef}
        className="flex-1 p-4 overflow-y-auto space-y-4"
        style={{ scrollBehavior: 'smooth' }}
      >
        {currentChat.map((message, index) => {
          // Animação para mensagens que aparecem em etapas
          const delay = index * 0.2;
          
          if (message.type === "thinking") {
            return (
              <motion.div
                key={index}
                className="flex items-start"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay }}
              >
                <div className="flex-1 max-w-[80%] bg-gray-100 rounded-lg p-3 ml-2">
                  <div className="flex space-x-1">
                    <div className="h-2 w-2 bg-gray-300 rounded-full animate-bounce"></div>
                    <div className="h-2 w-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                    <div className="h-2 w-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                  </div>
                </div>
              </motion.div>
            );
          }
          
          return (
            <motion.div
              key={index}
              className={`flex items-start ${message.type === "user" ? "justify-end" : ""}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay }}
            >
              {message.type === "bot" && (
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary-600 text-sm font-semibold">Z</span>
                </div>
              )}
              
              <div 
                className={`flex-1 max-w-[80%] ${
                  message.type === "user" 
                    ? "bg-primary-600 text-black rounded-lg rounded-tr-none" 
                    : "bg-gray-100 text-gray-800 rounded-lg rounded-tl-none"
                } p-3 mx-2`}
              >
                <div className="whitespace-pre-wrap">{message.text}</div>
                
                {message.title && (
                  <div className="mt-2 p-3 bg-white rounded-md shadow-sm">
                    <p className="font-semibold">{message.title}</p>
                    {message.day && <p className="text-sm mt-1">📅 {message.day}</p>}
                    {message.time && <p className="text-sm">🕒 {message.time}</p>}
                    {message.description && <p className="text-sm mt-1">{message.description}</p>}
                  </div>
                )}
              </div>
              
              {message.type === "user" && (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-gray-600 text-sm">EU</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
      
      {/* Área de entrada de mensagem */}
      <div className="p-3 border-t">
        <div className="flex items-center bg-gray-100 rounded-full px-4 py-2">
          <input
            type="text"
            placeholder="Digite uma mensagem..."
            className="flex-1 bg-transparent outline-none text-sm"
            disabled
          />
          <button className="ml-2 text-primary-600" disabled>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}