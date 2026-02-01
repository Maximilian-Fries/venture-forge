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
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppShell>
          <Routes>
            {/* Public route - Auth page */}
            <Route path="/auth" element={<Auth />} />

            {/* Protected routes - require authentication */}
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/new" element={<ProtectedRoute><Forge /></ProtectedRoute>} />
            <Route path="/forge/:id" element={<ProtectedRoute><Forge /></ProtectedRoute>} />
            <Route path="/gauntlet/:id" element={<ProtectedRoute><Gauntlet /></ProtectedRoute>} />
            <Route path="/analyze/:projectId" element={<ProtectedRoute><NewIdea /></ProtectedRoute>} />
            <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
