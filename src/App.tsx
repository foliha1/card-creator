import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-context";
import LandingPage from "./pages/LandingPage.tsx";
import MultiplayerPage from "./pages/MultiplayerPage.tsx";
import DailyPage from "./pages/DailyPage.tsx";
import SupportPage from "./pages/SupportPage.tsx";
import TypographyPage from "./pages/TypographyPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const FADE_MS = 200;

const AnimatedRoutes: React.FC = () => {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [stage, setStage] = useState<"fadeIn" | "fadeOut">("fadeIn");

  useEffect(() => {
    if (location.key === displayLocation.key) return;
    setStage("fadeOut");
    const id = window.setTimeout(() => {
      setDisplayLocation(location);
      setStage("fadeIn");
    }, FADE_MS);
    return () => window.clearTimeout(id);
  }, [location, displayLocation]);

  return (
    <div
      className="page-transition"
      style={{
        opacity: stage === "fadeIn" ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease`,
        minHeight: "100dvh",
      }}
    >
      <Routes location={displayLocation}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/play" element={<MultiplayerPage />} />
        <Route path="/solo" element={<MultiplayerPage />} />
        <Route path="/play/:roomCode" element={<MultiplayerPage />} />
        <Route path="/today" element={<DailyPage />} />
        <Route path="/about" element={<SupportPage />} />
        <Route path="/typography" element={<TypographyPage />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
