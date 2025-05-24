import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { FaTelegram } from "react-icons/fa";

export default function CtaSection() {
  return (
    <section className="py-16 md:py-24 bg-gradient-to-br from-primary to-secondary text-white">
      <div className="container mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Simplify Your Scheduling?</h2>
          <p className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
            Join thousands of users who are saving time and staying organized with Zelar's AI-powered scheduling assistant.
          </p>
          
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button 
              asChild
              variant="default"
              size="lg"
              className="bg-white text-primary hover:bg-gray-100 font-semibold rounded-full px-8 py-4 text-lg"
            >
              <a 
                href="https://t.me/zelar_bot" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center"
              >
                <FaTelegram className="mr-3 text-xl" />
                Start Using Zelar Now
              </a>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
