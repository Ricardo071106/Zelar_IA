import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import WhatsAppAdmin from "@/pages/WhatsAppAdmin";
import WhatsAppSimple from "@/pages/WhatsAppSimple";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/whatsapp" component={WhatsAppAdmin} />
      <Route path="/whatsapp-simples" component={WhatsAppSimple} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
