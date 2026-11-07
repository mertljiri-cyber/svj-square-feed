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
import TechnicalRegister from "./pages/TechnicalRegister";
import TechnicalAssetDetail from "./pages/TechnicalAssetDetail";
import RepairPlan from "./pages/RepairPlan";
import VerificationOverview from "./pages/VerificationOverview";
import Documents from "./pages/Documents";
import DocumentDetail from "./pages/DocumentDetail";
import Requests from "./pages/Requests";
import RequestDetail from "./pages/RequestDetail";
import RequestQueue from "./pages/RequestQueue";
import Login from "./pages/Login";
import Members from "./pages/Members";
import { AuthProvider } from "./features/auth/AuthProvider";
import { RequireMember } from "./features/auth/RequireMember";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/technicky-prehled" element={<TechnicalRegister />} />
          <Route path="/technicky-prehled/:id" element={<TechnicalAssetDetail />} />
          <Route path="/plan-oprav" element={<RepairPlan />} />
          <Route path="/dokumenty" element={<Documents />} />
          <Route path="/dokumenty/:id" element={<DocumentDetail />} />
          <Route path="/pozadavky" element={<Requests />} />
          <Route path="/pozadavky/fronta" element={<RequestQueue />} />
          <Route path="/pozadavky/:id" element={<RequestDetail />} />
          <Route path="/revize-a-overeni" element={<VerificationOverview />} />
          <Route path="/novinky" element={<News />} />
          <Route path="/novinky/:id" element={<NewsDetail />} />
          <Route path="/prihlaseni" element={<Login />} />
          <Route path="/clenove" element={<Members />} />
          <Route path="/zamery" element={<RequireMember><Intents /></RequireMember>} />
          <Route path="/zamery/:id" element={<RequireMember><IntentDetail /></RequireMember>} />
          <Route path="/formulare" element={<RequireMember><Forms /></RequireMember>} />
          <Route path="/formulare/:id" element={<RequireMember><FormDetail /></RequireMember>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
