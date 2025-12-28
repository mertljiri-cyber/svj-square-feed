import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import News from "./pages/News";
import NewsDetail from "./pages/NewsDetail";
import Intents from "./pages/Intents";
import IntentDetail from "./pages/IntentDetail";
import Forms from "./pages/Forms";
import FormDetail from "./pages/FormDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/novinky" element={<News />} />
          <Route path="/novinky/:id" element={<NewsDetail />} />
          <Route path="/zamery" element={<Intents />} />
          <Route path="/zamery/:id" element={<IntentDetail />} />
          <Route path="/formulare" element={<Forms />} />
          <Route path="/formulare/:id" element={<FormDetail />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
