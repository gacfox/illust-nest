import * as React from "react";
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
      toast.success("导出任务已完成");
    } catch (error) {
      console.error("导出失败", error);
      toast.error("导出失败");
    } finally {
      setExporting(false);
    }
  };

  return (
    <AdminLayout
      title="作品导出"
      breadcrumbs={[{ label: "作品导出" }]}
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
                导出全部已上传图片
              </h2>
              <p className="text-sm text-muted-foreground">
                一键打包为 ZIP 文件并下载到本地
              </p>
            </div>
          </div>

          <div className="mb-6 space-y-2 text-sm text-muted-foreground">
            <p>1. 导出范围：系统中已上传并保存在服务器中的所有原图文件。</p>
            <p>2. 输出格式：`zip` 压缩包，文件结构保留上传目录层级。</p>
            <p>3. 注意事项：导出文件较大时，下载会持续更久，请耐心等待。</p>
          </div>

          <Button onClick={handleExport} disabled={exporting}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "导出中..." : "导出全部图片"}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
