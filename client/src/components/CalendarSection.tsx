import { motion } from "framer-motion";
import { FaGoogle, FaApple } from "react-icons/fa";
import { ArrowLeftRight } from "lucide-react";

export default function CalendarSection() {
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="container mx-auto px-4">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Seamless Calendar Integration</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Zelar works with your favorite calendar apps to keep all your schedules in one place.
          </p>
        </motion.div>
        
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-center">
          <motion.div 
            className="lg:col-span-2 order-2 lg:order-1"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h3 className="text-2xl font-semibold mb-4">Your Events, Everywhere You Need Them</h3>
            <p className="text-gray-600 mb-6">
              When Zelar schedules an event for you, it automatically syncs with your preferred calendar application, ensuring all your devices stay updated.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="bg-primary/10 rounded-full p-2 mr-3 mt-1">
                  <FaGoogle className="text-primary" />
                </div>
                <div>
                  <h4 className="font-medium">Google Calendar</h4>
                  <p className="text-sm text-gray-600">Sync with your Google account for seamless integration across all your devices.</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="bg-primary/10 rounded-full p-2 mr-3 mt-1">
                  <FaApple className="text-primary" />
                </div>
                <div>
                  <h4 className="font-medium">Apple Calendar</h4>
                  <p className="text-sm text-gray-600">Perfect integration with your iPhone, iPad, and Mac devices.</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="bg-primary/10 rounded-full p-2 mr-3 mt-1">
                  <ArrowLeftRight className="text-primary" />
                </div>
                <div>
                  <h4 className="font-medium">Two-Way Synchronization</h4>
                  <p className="text-sm text-gray-600">Updates made in your calendar app are reflected in Zelar, and vice versa.</p>
                </div>
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            className="lg:col-span-3 order-1 lg:order-2"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            {/* Calendar integration visualization */}
            <div className="relative">
              {/* Calendar mockup */}
              <div className="bg-white rounded-xl shadow-xl overflow-hidden">
                <div className="bg-primary text-white p-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">October 2023</h3>
                    <div className="flex space-x-2">
                      <button className="bg-white/20 rounded p-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m15 18-6-6 6-6" />
                        </svg>
                      </button>
                      <button className="bg-white/20 rounded p-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="p-4">
                  <div className="grid grid-cols-7 gap-1 text-center mb-2">
                    <div className="text-sm font-medium">Sun</div>
                    <div className="text-sm font-medium">Mon</div>
                    <div className="text-sm font-medium">Tue</div>
                    <div className="text-sm font-medium">Wed</div>
                    <div className="text-sm font-medium">Thu</div>
                    <div className="text-sm font-medium">Fri</div>
                    <div className="text-sm font-medium">Sat</div>
                  </div>
                  
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {/* Week 1 */}
                    {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                      <div key={`week1-${day}`} className="h-20 p-1 border rounded text-gray-400">{day}</div>
                    ))}
                    
                    {/* Week 2 */}
                    <div className="h-20 p-1 border rounded">8</div>
                    <div className="h-20 p-1 border rounded">9</div>
                    <div className="h-20 p-1 border rounded">10</div>
                    <div className="h-20 p-1 border rounded">11</div>
                    <div className="h-20 p-1 border rounded">12</div>
                    <div className="h-20 p-1 border rounded bg-primary/5 relative">
                      <span>13</span>
                      <div className="absolute bottom-1 left-1 right-1 bg-primary text-white text-xs p-1 rounded">
                        3:00 PM Meeting
                      </div>
                    </div>
                    <div className="h-20 p-1 border rounded">14</div>
                    
                    {/* Week 3 */}
                    <div className="h-20 p-1 border rounded">15</div>
                    <div className="h-20 p-1 border rounded bg-primary/5 relative">
                      <span>16</span>
                      <div className="absolute bottom-1 left-1 right-1 bg-accent text-white text-xs p-1 rounded">
                        10:00 AM Dentist
                      </div>
                    </div>
                    <div className="h-20 p-1 border rounded">17</div>
                    <div className="h-20 p-1 border rounded">18</div>
                    <div className="h-20 p-1 border rounded">19</div>
                    <div className="h-20 p-1 border rounded">20</div>
                    <div className="h-20 p-1 border rounded">21</div>
                    
                    {/* Week 4 */}
                    <div className="h-20 p-1 border rounded">22</div>
                    <div className="h-20 p-1 border rounded">23</div>
                    <div className="h-20 p-1 border rounded">24</div>
                    <div className="h-20 p-1 border rounded bg-primary/5 relative">
                      <span>25</span>
                      <div className="absolute bottom-1 left-1 right-1 bg-primary text-white text-xs p-1 rounded">
                        1:30 PM Call
                      </div>
                    </div>
                    <div className="h-20 p-1 border rounded">26</div>
                    <div className="h-20 p-1 border rounded">27</div>
                    <div className="h-20 p-1 border rounded">28</div>
                    
                    {/* Week 5 */}
                    <div className="h-20 p-1 border rounded">29</div>
                    <div className="h-20 p-1 border rounded">30</div>
                    <div className="h-20 p-1 border rounded">31</div>
                    <div className="h-20 p-1 border rounded text-gray-400">1</div>
                    <div className="h-20 p-1 border rounded text-gray-400">2</div>
                    <div className="h-20 p-1 border rounded text-gray-400">3</div>
                    <div className="h-20 p-1 border rounded text-gray-400">4</div>
                  </div>
                </div>
              </div>
              
              {/* Calendar notification */}
              <motion.div 
                className="absolute -top-6 -right-6 bg-white rounded-xl shadow-lg p-3 w-64 border-l-4 border-primary transform rotate-3 z-10"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <div className="flex items-start">
                  <div className="bg-primary/10 rounded-full p-2 mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                      <line x1="16" x2="16" y1="2" y2="6" />
                      <line x1="8" x2="8" y1="2" y2="6" />
                      <line x1="3" x2="21" y1="10" y2="10" />
                      <path d="m9 16 2 2 4-4" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">New Event Added</h4>
                    <p className="text-xs text-gray-600">Meeting with John at 3:00 PM on Friday</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
