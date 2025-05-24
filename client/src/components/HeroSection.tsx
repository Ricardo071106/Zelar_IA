import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { FaTelegram } from "react-icons/fa";

export default function HeroSection() {
  return (
    <section className="pt-24 pb-16 md:pt-32 md:pb-24 bg-gradient-to-br from-primary to-secondary text-white relative">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center">
          <motion.div 
            className="md:w-1/2 mb-10 md:mb-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Your Smart AI Scheduling Assistant on Telegram
            </h1>
            <p className="text-lg md:text-xl mb-8 text-white/90">
              Schedule appointments, manage events, and get timely reminders through natural voice or text messages on Telegram.
            </p>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <Button 
                asChild
                variant="default"
                size="lg"
                className="bg-white text-primary hover:bg-gray-100 font-semibold rounded-full"
              >
                <a 
                  href="https://t.me/zelar_bot" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center"
                >
                  <FaTelegram className="mr-2 text-xl" />
                  Start Using Zelar
                </a>
              </Button>
              <Button 
                asChild
                variant="outline"
                size="lg"
                className="bg-transparent hover:bg-white/10 border-2 border-white font-semibold rounded-full"
              >
                <a href="#how-it-works">
                  Learn More
                </a>
              </Button>
            </div>
          </motion.div>
          
          <motion.div 
            className="md:w-1/2 flex justify-center md:justify-end"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {/* Smartphone mockup */}
            <div className="relative w-72 h-[500px] md:w-80 md:h-[560px]">
              <div className="absolute inset-0 bg-black rounded-[40px] shadow-xl"></div>
              <div className="absolute inset-2 bg-white rounded-[32px] overflow-hidden">
                <div className="bg-[#f6f6f6] h-full flex flex-col">
                  {/* Header */}
                  <div className="bg-primary py-3 px-4 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-3">
                      <path d="m15 19-7-7 7-7" />
                    </svg>
                    <div>
                      <p className="text-white font-medium">Zelar Bot</p>
                      <p className="text-white text-xs opacity-80">Online</p>
                    </div>
                  </div>
                  
                  {/* Chat area */}
                  <div className="flex-1 p-3 overflow-y-auto">
                    <div className="bg-white rounded-lg p-3 shadow-sm mb-3 max-w-[80%]">
                      <p className="text-sm">👋 Welcome to Zelar! I'm your personal scheduling assistant. Send me a voice message or text about your upcoming events.</p>
                    </div>
                    
                    <div className="bg-primary rounded-lg p-3 shadow-sm mb-3 ml-auto max-w-[80%]">
                      <p className="text-sm text-white">I need to schedule a meeting with John on Friday at 3pm about the project proposal.</p>
                    </div>
                    
                    <div className="bg-white rounded-lg p-3 shadow-sm mb-3 max-w-[80%]">
                      <p className="text-sm">✅ I've scheduled your meeting with John on Friday, October 13th at 3:00 PM with the topic "Project Proposal".</p>
                      <div className="mt-2 bg-gray-100 rounded-md p-2">
                        <p className="text-xs font-medium">Meeting with John</p>
                        <p className="text-xs text-gray-600">Friday, Oct 13 • 3:00 PM</p>
                        <p className="text-xs text-gray-600">Topic: Project Proposal</p>
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-3 shadow-sm mb-3 max-w-[80%]">
                      <p className="text-sm">I've added this event to your calendar and will remind you 24 hours and 30 minutes before the meeting. Is there anything else you'd like to schedule?</p>
                    </div>
                  </div>
                  
                  {/* Message input */}
                  <div className="bg-gray-100 p-3 flex items-center">
                    <div className="bg-white rounded-full flex-1 py-2 px-4 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary mr-2">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" x2="12" y1="19" y2="22" />
                      </svg>
                      <span className="text-gray-400 text-sm">Message or voice note</span>
                    </div>
                    <button className="ml-2 bg-primary text-white rounded-full w-10 h-10 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m22 2-7 20-4-9-9-4Z" />
                        <path d="M22 2 11 13" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
      
      {/* Wave SVG */}
      <div className="absolute bottom-0 left-0 w-full overflow-hidden line-height-0">
        <svg data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none" className="relative block w-[calc(100%+1.3px)] h-[70px]">
          <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" fill="#FFFFFF" />
        </svg>
      </div>
    </section>
  );
}
