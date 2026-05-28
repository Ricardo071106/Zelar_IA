import { useEffect, useRef } from "react";
import { format, addDays } from "date-fns";
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

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [step]);

  const tomorrow = format(addDays(new Date(), 1), "EEEE, dd 'de' MMMM", { locale: ptBR });

  const chatDemo: ChatMessage[][] = [
    [
      {
        type: "bot",
        text: "Olá! Sou o Zelar. Me diga o horário — cliente, serviço e dia.",
      },
    ],
    [
      {
        type: "bot",
        text: "Olá! Sou o Zelar. Me diga o horário — cliente, serviço e dia.",
      },
      { type: "user", text: "Manicure com a Carla sexta às 14h" },
      { type: "thinking", text: "Organizando..." },
    ],
    [
      {
        type: "bot",
        text: "Olá! Sou o Zelar. Me diga o horário — cliente, serviço e dia.",
      },
      { type: "user", text: "Manicure com a Carla sexta às 14h" },
      {
        type: "bot",
        text: "Agendado na sua agenda!",
        title: "Manicure · Carla",
        day: tomorrow,
        time: "14:00",
      },
    ],
    [
      {
        type: "bot",
        text: "Olá! Sou o Zelar. Me diga o horário — cliente, serviço e dia.",
      },
      { type: "user", text: "Manicure com a Carla sexta às 14h" },
      {
        type: "bot",
        text: "Agendado na sua agenda!",
        title: "Manicure · Carla",
        day: tomorrow,
        time: "14:00",
      },
      { type: "user", text: "Quem tenho amanhã?" },
      {
        type: "bot",
        text: "Amanhã você tem:\n\nManicure · Carla\n14:00\n\nLembrete de confirmação já enviado para ela.",
      },
    ],
  ];

  const currentChat = chatDemo[Math.min(step, chatDemo.length - 1)];

  return (
    <div className="flex flex-col h-[420px] sm:h-[460px] overflow-hidden bg-[#ece5dd]">
      <div className="flex items-center p-3 bg-[#075E54]">
        <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center">
          <span className="text-white text-sm font-bold">Z</span>
        </div>
        <div className="ml-3">
          <h3 className="font-medium text-white text-sm">Zelar</h3>
          <p className="text-xs text-emerald-100">online</p>
        </div>
      </div>

      <div ref={chatRef} className="flex-1 p-3 overflow-y-auto space-y-2" style={{ scrollBehavior: "smooth" }}>
        {currentChat.map((message, index) => {
          const delay = index * 0.15;

          if (message.type === "thinking") {
            return (
              <motion.div
                key={index}
                className="flex items-start"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay }}
              >
                <div className="max-w-[80%] bg-white rounded-lg rounded-tl-none p-3 shadow-sm">
                  <div className="flex space-x-1">
                    <div className="h-2 w-2 bg-emerald-300 rounded-full animate-bounce" />
                    <div
                      className="h-2 w-2 bg-emerald-300 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    />
                    <div
                      className="h-2 w-2 bg-emerald-300 rounded-full animate-bounce"
                      style={{ animationDelay: "0.4s" }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          }

          const isUser = message.type === "user";

          return (
            <motion.div
              key={index}
              className={`flex items-end gap-1 ${isUser ? "justify-end" : ""}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay }}
            >
              <div
                className={`max-w-[85%] p-2.5 shadow-sm ${
                  isUser
                    ? "bg-[#DCF8C6] text-slate-800 rounded-lg rounded-tr-none"
                    : "bg-white text-slate-800 rounded-lg rounded-tl-none"
                }`}
              >
                <div className="whitespace-pre-wrap text-sm">{message.text}</div>

                {message.title && (
                  <div className="mt-2 p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
                    <p className="font-semibold text-sm text-emerald-900">{message.title}</p>
                    {message.day && <p className="text-xs mt-1 text-slate-600">{message.day}</p>}
                    {message.time && <p className="text-xs text-slate-600">{message.time}</p>}
                    {message.description && <p className="text-xs mt-1 text-slate-600">{message.description}</p>}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="p-2.5 bg-[#f0f0f0]">
        <div className="flex items-center bg-white rounded-full px-4 py-2">
          <span className="flex-1 text-sm text-slate-400">Mensagem</span>
          <div className="w-8 h-8 rounded-full bg-[#075E54] flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="white"
              className="h-4 w-4"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
