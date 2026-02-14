import { BrowserRouter as Router } from "react-router-dom";
import { RoutesView } from "@/Routes";
import { useSystemStatus } from "@/hooks/useSystemStatus";
import { InitPage } from "@/pages/InitPage";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";

function App() {
  const { status, loading } = useSystemStatus();

  return (
    <ThemeProvider defaultTheme="system" storageKey="theme_preference">
      {loading ? (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <p>加载中...</p>
        </div>
      ) : !status?.initialized ? (
        <InitPage />
      ) : (
        <Router
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <RoutesView />
        </Router>
      )}
      <Toaster position="top-center" richColors closeButton />
    </ThemeProvider>
  );
}

export default App;
