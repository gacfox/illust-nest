import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
      console.error("加载统计数据失败", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatistics();
  }, []);

  return (
    <AdminLayout
      title="数据统计"
      breadcrumbs={[{ label: "数据统计" }]}
      headerAction={
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void loadStatistics()}
          disabled={loading}
          aria-label="刷新统计数据"
        >
          <RefreshCw
            className={["h-4 w-4", loading ? "animate-spin" : ""].join(" ")}
          />
        </Button>
      }
      onLogout={handleLogout}
    >
      {loading ? (
        <div className="text-center text-muted-foreground">加载中...</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="作品数" value={stats.work_count} icon={Images} />
            <StatCard title="图片数" value={stats.image_count} icon={Images} />
            <StatCard title="标签数" value={stats.tag_count} icon={Tags} />
            <StatCard
              title="作品集数"
              value={stats.collection_count}
              icon={FolderKanban}
            />
          </div>

          <Card>
            <CardHeader className="space-y-2">
              <CardTitle>重复图片统计</CardTitle>
              <p className="text-sm text-muted-foreground">
                按图片哈希分组，共 {stats.duplicate_image_groups.length}{" "}
                组重复图片
              </p>
            </CardHeader>
            <CardContent>
              {stats.duplicate_image_groups.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  暂未检测到重复图片
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
                            aria-label={`预览 hash ${group.image_hash} 图片`}
                          >
                            <Image className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          重复图片 {group.total_images} 张
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
                                作品 ID: {work.work_id}
                              </span>
                              <span className="ml-3 text-muted-foreground">
                                图片 {work.duplicate_count} 张
                              </span>
                            </div>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() =>
                                navigate(`/works/${work.work_id}/preview`)
                              }
                              aria-label={`查看作品 ${work.work_id} 预览`}
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
            <DialogTitle>重复图片预览</DialogTitle>
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
            <div className="text-sm text-muted-foreground">暂无可预览图片</div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
