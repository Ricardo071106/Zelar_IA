import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import SystemDashboard from "@/pages/SystemDashboard";
import AnalyticsDashboardPage from "@/pages/analytics-dashboard";
import UserPanelPage from "@/pages/UserPanelPage";
import PanelLoginPage from "@/pages/PanelLoginPage";
import PanelRegisterPage from "@/pages/PanelRegisterPage";
import { AppErrorBoundary } from "@/AppErrorBoundary";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/painel/entrar" component={PanelLoginPage} />
      <Route path="/painel/registro" component={PanelRegisterPage} />
      <Route path="/painel" component={UserPanelPage} />
      <Route path="/system" component={SystemDashboard} />
      <Route path="/analytics-dashboard" component={AnalyticsDashboardPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppErrorBoundary>
          <Router />
        </AppErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
