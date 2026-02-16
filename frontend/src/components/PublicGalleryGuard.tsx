import { useSystemStatus } from "@/hooks/useSystemStatus";
import { NotFoundPage } from "@/pages/NotFoundPage";

type PublicGalleryGuardProps = {
  children: React.ReactElement;
};

export function PublicGalleryGuard({ children }: PublicGalleryGuardProps) {
  const { status, loading } = useSystemStatus();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <p>加载中...</p>
      </div>
    );
  }

  if (!status?.public_gallery_enabled) {
    return <NotFoundPage />;
  }

  return children;
}
