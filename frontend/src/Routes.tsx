import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores";
import { LoginPage } from "@/pages/LoginPage";
import { HomePage } from "@/pages/HomePage";
import { SettingsPage } from "@/pages/SettingsPage";

import { WorkEditPage } from "@/pages/WorkEditPage";
import { WorkPreviewPage } from "@/pages/WorkPreviewPage";
import { PublicWorksPage } from "@/pages/PublicWorksPage";
import { TagsPage } from "@/pages/TagsPage";
import { StatisticsPage } from "@/pages/StatisticsPage";
import { CollectionsPage } from "@/pages/CollectionsPage";
import { CollectionWorksPage } from "@/pages/CollectionWorksPage";
import { WorkExportPage } from "@/pages/WorkExportPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PublicGalleryGuard } from "@/components/PublicGalleryGuard";

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
      <Route
        path="/public/works"
        element={
          <PublicGalleryGuard>
            <PublicWorksPage />
          </PublicGalleryGuard>
        }
      />
      <Route
        path="/public/works/:id/preview"
        element={
          <PublicGalleryGuard>
            <WorkPreviewPage publicMode />
          </PublicGalleryGuard>
        }
      />
      <Route path="/works/:id" element={requireAuth(<WorkEditPage />)} />
      <Route path="/works/export" element={requireAuth(<WorkExportPage />)} />
      <Route path="/collections" element={requireAuth(<CollectionsPage />)} />
      <Route
        path="/collections/:id/works"
        element={requireAuth(<CollectionWorksPage />)}
      />
      <Route path="/tags" element={requireAuth(<TagsPage />)} />
      <Route path="/statistics" element={requireAuth(<StatisticsPage />)} />
      <Route path="/settings" element={requireAuth(<SettingsPage />)} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
