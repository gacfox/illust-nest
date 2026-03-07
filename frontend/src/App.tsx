import { BrowserRouter as Router } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { RoutesView } from "@/Routes";
import { useSystemStatus } from "@/hooks/useSystemStatus";
import { InitPage } from "@/pages/InitPage";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";

function App() {
  const { t } = useTranslation();
  const { status, loading } = useSystemStatus();

  return (
    <ThemeProvider defaultTheme="system" storageKey="theme_preference">
      {loading ? (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <p>{t("app.loading")}</p>
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
