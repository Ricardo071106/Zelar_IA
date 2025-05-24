import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const chatMessages: Record<number, ChatMessage[]> = {
    1: [
      { type: 'user', text: '🎤 Voice message (0:12)' },
      { type: 'user-transcript', text: 'I need to schedule a team meeting next Tuesday at 2pm to discuss the Q4 marketing strategy.' }
    ],
    2: [
      { type: 'bot', text: '🧠 Processing your schedule...' },
      { type: 'bot', text: 'I detected the following event details:' },
      { type: 'bot-data', title: 'Team Meeting', day: 'Tuesday, October 17', time: '2:00 PM', description: 'Discuss Q4 marketing strategy' }
    ],
    3: [
      { type: 'bot', text: '✅ I\'ve created this event in your calendar:' },
      { type: 'bot-calendar', title: 'Team Meeting', day: 'Tuesday, October 17', time: '2:00 PM', description: 'Discuss Q4 marketing strategy' },
      { type: 'bot', text: 'This event has been added to your Google Calendar.' }
    ],
    4: [
      { type: 'bot-reminder', title: 'Reminder: Team Meeting Tomorrow', text: 'You have a team meeting tomorrow at 2:00 PM to discuss Q4 marketing strategy.' },
      { type: 'bot-reminder', title: 'Reminder: Team Meeting in 30 minutes', text: 'Your team meeting starts in 30 minutes. Topic: Q4 marketing strategy.' }
    ]
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [step]);

  return (
    <div className="h-full bg-[#f6f6f6] p-4 overflow-y-auto" ref={chatContainerRef}>
      {/* Initial welcome message */}
      <div className="bg-white rounded-lg p-3 shadow-sm mb-3 max-w-[80%]">
        <p className="text-sm">Hi! I'm Zelar, your personal scheduling assistant. How can I help you today?</p>
      </div>

      {/* Step-specific messages */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {chatMessages[step].map((message, index) => {
            // Add a delay for each message
            const delay = index * 0.5;

            if (message.type === 'user') {
              return (
                <motion.div 
                  key={`${step}-${index}`}
                  className="bg-gray-100 rounded-lg p-3 shadow-sm mb-3 ml-auto max-w-[80%]"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay }}
                >
                  <p className="text-sm">{message.text}</p>
                </motion.div>
              );
            } 
            else if (message.type === 'user-transcript') {
              return (
                <motion.div 
                  key={`${step}-${index}`}
                  className="bg-gray-100 rounded-lg p-3 shadow-sm mb-3 ml-auto max-w-[80%] border-l-4 border-primary"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay }}
                >
                  <p className="text-sm italic">"{message.text}"</p>
                </motion.div>
              );
            }
            else if (message.type === 'bot') {
              return (
                <motion.div 
                  key={`${step}-${index}`}
                  className="bg-white rounded-lg p-3 shadow-sm mb-3 max-w-[80%]"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay }}
                >
                  <p className="text-sm">{message.text}</p>
                </motion.div>
              );
            }
            else if (message.type === 'bot-data') {
              return (
                <motion.div 
                  key={`${step}-${index}`}
                  className="bg-white rounded-lg p-3 shadow-sm mb-3 max-w-[80%]"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay }}
                >
                  <p className="text-sm">Event details:</p>
                  <div className="mt-2 bg-gray-100 rounded-md p-2">
                    <p className="text-xs font-medium">{message.title}</p>
                    <p className="text-xs text-gray-600">{message.day} • {message.time}</p>
                    <p className="text-xs text-gray-600">Description: {message.description}</p>
                  </div>
                </motion.div>
              );
            }
            else if (message.type === 'bot-calendar') {
              return (
                <motion.div 
                  key={`${step}-${index}`}
                  className="bg-white rounded-lg p-3 shadow-sm mb-3 max-w-[80%]"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay }}
                >
                  <div className="bg-primary/10 rounded-md p-3 border-l-4 border-primary">
                    <div className="flex items-start">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary mr-2 mt-1">
                        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                        <line x1="16" x2="16" y1="2" y2="6" />
                        <line x1="8" x2="8" y1="2" y2="6" />
                        <line x1="3" x2="21" y1="10" y2="10" />
                        <path d="m9 16 2 2 4-4" />
                      </svg>
                      <div>
                        <p className="text-xs font-semibold">{message.title}</p>
                        <p className="text-xs text-gray-600">{message.day} • {message.time}</p>
                        <p className="text-xs text-gray-600">{message.description}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            }
            else if (message.type === 'bot-reminder') {
              return (
                <motion.div 
                  key={`${step}-${index}`}
                  className="bg-white rounded-lg p-3 shadow-sm mb-3 max-w-[80%]"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay }}
                >
                  <div className="bg-accent/10 rounded-md p-3 border-l-4 border-accent">
                    <div className="flex items-start">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent mr-2 mt-1">
                        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                      </svg>
                      <div>
                        <p className="text-xs font-semibold">{message.title}</p>
                        <p className="text-xs text-gray-600">{message.text}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            }
            return null;
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
