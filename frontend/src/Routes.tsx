import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores";
import { LoginPage } from "@/pages/LoginPage";
import { HomePage } from "@/pages/HomePage";
import { SettingsPage } from "@/pages/SettingsPage";

import { WorkEditPage } from "@/pages/WorkEditPage";
import { WorkPreviewPage } from "@/pages/WorkPreviewPage";
import { TagsPage } from "@/pages/TagsPage";

export function RoutesView() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();

  const requireAuth = (element: React.ReactElement) =>
    isAuthenticated ? (
      element
    ) : (
      <Navigate to="/login" state={{ from: location }} replace />
    );

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={requireAuth(<HomePage />)} />
      <Route
        path="/works/new"
        element={<Navigate to="/works/create" replace />}
      />
      <Route path="/works/create" element={requireAuth(<WorkEditPage />)} />
      <Route
        path="/works/:id/preview"
        element={requireAuth(<WorkPreviewPage />)}
      />
      <Route path="/works/:id" element={requireAuth(<WorkEditPage />)} />
      <Route path="/tags" element={requireAuth(<TagsPage />)} />
      <Route path="/settings" element={requireAuth(<SettingsPage />)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
