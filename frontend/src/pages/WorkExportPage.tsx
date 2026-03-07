import * as React from "react";
import { useTranslation } from "react-i18next";
import { Download, FileArchive } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { workService } from "@/services";
import { useAuthStore } from "@/stores";

function parseFilename(contentDisposition?: string): string {
  if (!contentDisposition) {
    return "illust-nest-images.zip";
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const basicMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (basicMatch?.[1]) {
    return basicMatch[1];
  }

  return "illust-nest-images.zip";
}

export function WorkExportPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [exporting, setExporting] = React.useState(false);

  const handleLogout = () => {
    clearAuth();
    localStorage.removeItem("token");
    navigate("/login");
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await workService.exportImages();
      const disposition = res.headers["content-disposition"];
      const filename = parseFilename(
        typeof disposition === "string" ? disposition : undefined,
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t("export.success"));
    } catch (error) {
      console.error(t("export.failed"), error);
      toast.error(t("export.failed"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <AdminLayout
      title={t("export.title")}
      breadcrumbs={[{ label: t("export.title") }]}
      onLogout={handleLogout}
    >
      <div className="max-w-3xl">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileArchive className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {t("export.exportTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("export.exportDescription")}
              </p>
            </div>
          </div>

          <div className="mb-6 space-y-2 text-sm text-muted-foreground">
            <p>{t("export.steps.scope")}</p>
            <p>{t("export.steps.format")}</p>
            <p>{t("export.steps.note")}</p>
          </div>

          <Button onClick={handleExport} disabled={exporting}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? t("export.exporting") : t("export.exportButton")}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
