import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/Auth";
import NewIdea from "./pages/NewIdea";
import Dashboard from "./pages/Dashboard";
import Forge from "./pages/Forge";
import Gauntlet from "./pages/Gauntlet";
import ProjectDetails from "./pages/ProjectDetails";
import NotFound from "./pages/NotFound";
import { AppShell } from "./components/AppShell";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/new" element={<Forge />} />
            <Route path="/forge/:id" element={<Forge />} />
            <Route path="/gauntlet/:id" element={<Gauntlet />} />
            <Route path="/analyze/:projectId" element={<NewIdea />} />
            <Route path="/projects/:id" element={<ProjectDetails />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
