import { BrowserRouter as Router } from "react-router-dom";
import { RoutesView } from "@/Routes";
import { useSystemStatus } from "@/hooks/useSystemStatus";
import { InitPage } from "@/pages/InitPage";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";

function App() {
  const { status, loading } = useSystemStatus();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <p>加载中...</p>
      </div>
    );
  }

  if (!status?.initialized) {
    return <InitPage />;
  }

  return (
    <ThemeProvider defaultTheme="system" storageKey="theme_preference">
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <RoutesView />
        <Toaster position="top-center" richColors closeButton />
      </Router>
    </ThemeProvider>
  );
}

export default App;
