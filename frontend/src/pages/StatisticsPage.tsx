import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowUpRight,
  FolderKanban,
  Image,
  Images,
  RefreshCw,
  Tags,
} from "lucide-react";

import { AdminLayout } from "@/components/AdminLayout";
import { AuthImage } from "@/components/AuthImage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { systemService } from "@/services";
import { useAuthStore } from "@/stores";
import type { DuplicateImageGroup, SystemStatistics } from "@/types/api";

type StatCardProps = {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
};

function StatCard({ title, value, icon: Icon }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight">
          {value.toLocaleString("zh-CN")}
        </div>
      </CardContent>
    </Card>
  );
}

export function StatisticsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SystemStatistics>({
    work_count: 0,
    image_count: 0,
    tag_count: 0,
    collection_count: 0,
    duplicate_image_groups: [],
  });
  const [previewGroup, setPreviewGroup] = useState<DuplicateImageGroup | null>(
    null,
  );

  const handleLogout = () => {
    clearAuth();
    localStorage.removeItem("token");
    navigate("/login");
  };

  const loadStatistics = async () => {
    setLoading(true);
    try {
      const res = await systemService.getStatistics();
      if (res.data.code === 0) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error(t("statistics.loadFailed"), err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatistics();
  }, []);

  return (
    <AdminLayout
      title={t("statistics.title")}
      breadcrumbs={[{ label: t("statistics.title") }]}
      headerAction={
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void loadStatistics()}
          disabled={loading}
          aria-label={t("statistics.refreshStats")}
        >
          <RefreshCw
            className={["h-4 w-4", loading ? "animate-spin" : ""].join(" ")}
          />
        </Button>
      }
      onLogout={handleLogout}
    >
      {loading ? (
        <div className="text-center text-muted-foreground">
          {t("app.loading")}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title={t("statistics.workCount")}
              value={stats.work_count}
              icon={Images}
            />
            <StatCard
              title={t("statistics.imageCount")}
              value={stats.image_count}
              icon={Images}
            />
            <StatCard
              title={t("statistics.tagCount")}
              value={stats.tag_count}
              icon={Tags}
            />
            <StatCard
              title={t("statistics.collectionCount")}
              value={stats.collection_count}
              icon={FolderKanban}
            />
          </div>

          <Card>
            <CardHeader className="space-y-2">
              <CardTitle>{t("statistics.duplicateImages")}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("statistics.duplicateImagesDescription", {
                  count: stats.duplicate_image_groups.length,
                })}
              </p>
            </CardHeader>
            <CardContent>
              {stats.duplicate_image_groups.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  {t("statistics.noDuplicates")}
                </div>
              ) : (
                <div className="space-y-3 max-h-136 overflow-auto pr-1">
                  {stats.duplicate_image_groups.map((group) => (
                    <div
                      key={group.image_hash}
                      className="rounded-lg border border-border p-3"
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1">
                          <code className="text-xs text-muted-foreground break-all">
                            hash: {group.image_hash}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="h-6 w-6 shrink-0"
                            onClick={() => setPreviewGroup(group)}
                            disabled={!group.preview_thumbnail_path}
                            aria-label={t("ariaLabels.hashPreview", {
                              hash: group.image_hash,
                            })}
                          >
                            <Image className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {t("statistics.duplicateCount", {
                            count: group.total_images,
                          })}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {group.works.map((work) => (
                          <div
                            key={`${group.image_hash}-${work.work_id}`}
                            className="flex items-center justify-between rounded-md bg-accent/30 px-3 py-2"
                          >
                            <div className="text-sm">
                              <span className="font-medium">
                                {t("statistics.workId")}: {work.work_id}
                              </span>
                              <span className="ml-3 text-muted-foreground">
                                {t("statistics.imageCountShort", {
                                  count: work.duplicate_count,
                                })}
                              </span>
                            </div>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() =>
                                navigate(`/works/${work.work_id}/preview`)
                              }
                              aria-label={t("ariaLabels.viewWorkPreview")}
                            >
                              <ArrowUpRight className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog
        open={Boolean(previewGroup)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewGroup(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("statistics.previewTitle")}</DialogTitle>
            <DialogDescription className="break-all">
              {previewGroup?.image_hash}
            </DialogDescription>
          </DialogHeader>
          {previewGroup?.preview_thumbnail_path ? (
            <AuthImage
              path={previewGroup.preview_thumbnail_path}
              alt={`duplicate-${previewGroup.image_hash}`}
              className="max-h-[70vh] w-full rounded-md border border-border object-contain"
            />
          ) : (
            <div className="text-sm text-muted-foreground">
              {t("statistics.noPreview")}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
