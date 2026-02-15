import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { systemService } from "@/services";
import { useAuthStore, useSystemStore } from "@/stores";
import type { SystemSettings } from "@/types/api";
import { CircleHelp } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function SettingsPage() {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const systemSettings = useSystemStore((state) => state.settings);
  const setSettings = useSystemStore((state) => state.setSettings);

  const [settings, setLocalSettings] = useState<SystemSettings>({
    public_gallery_enabled: false,
    site_title: "",
    imagemagick_enabled: false,
    imagemagick_version: "v7",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingImageMagick, setTestingImageMagick] = useState(false);

  useEffect(() => {
    if (systemSettings) {
      setLocalSettings(systemSettings);
    }
  }, [systemSettings]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await systemService.getSettings();
      if (res.data.code === 0) {
        const data = res.data.data;
        setSettings(data);
        setLocalSettings(data);
      }
    } catch (err) {
      console.error("加载设置失败", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await systemService.updateSettings(settings);
      if (res.data.code === 0) {
        setSettings(settings);
        toast.success("设置已保存");
      } else {
        toast.error(res.data.message || "保存失败");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    localStorage.removeItem("token");
    navigate("/login");
  };

  const handleTestImageMagick = async () => {
    setTestingImageMagick(true);
    try {
      const res = await systemService.testImageMagick(
        settings.imagemagick_version,
      );
      if (res.data.code === 0) {
        toast.success(
          `ImageMagick 可用（命令：${res.data.data.command}）。${res.data.data.message}`,
        );
      } else {
        toast.error(res.data.message || "ImageMagick 测试失败");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "ImageMagick 测试失败");
    } finally {
      setTestingImageMagick(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout
        title="系统设置"
        breadcrumbs={[{ label: "系统设置" }]}
        onLogout={handleLogout}
      >
        <div className="text-center text-muted-foreground">加载中...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="系统设置"
      breadcrumbs={[{ label: "系统设置" }]}
      onLogout={handleLogout}
    >
      <div className="max-w-2xl">
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-medium text-foreground mb-4">
              系统设置
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  网站标题
                </label>
                <Input
                  type="text"
                  value={settings.site_title}
                  onChange={(e) =>
                    setLocalSettings({
                      ...settings,
                      site_title: e.target.value,
                    })
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="public_gallery"
                  checked={settings.public_gallery_enabled}
                  onCheckedChange={(checked) =>
                    setLocalSettings({
                      ...settings,
                      public_gallery_enabled: checked === true,
                    })
                  }
                />
                <label
                  htmlFor="public_gallery"
                  className="text-sm text-foreground cursor-pointer"
                >
                  启用公开展示
                </label>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-medium text-foreground">
                ImageMagick 设置
              </h2>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 rounded-full text-muted-foreground"
                      aria-label="ImageMagick 说明"
                    >
                      <CircleHelp className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>
                    用于 PSD 等格式转码预览。v7 使用 magick 命令，v6 使用
                    convert 命令。
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="imagemagick_enabled"
                  checked={settings.imagemagick_enabled}
                  onCheckedChange={(checked) =>
                    setLocalSettings({
                      ...settings,
                      imagemagick_enabled: checked === true,
                    })
                  }
                />
                <label
                  htmlFor="imagemagick_enabled"
                  className="text-sm text-foreground cursor-pointer"
                >
                  启用 ImageMagick 集成
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  ImageMagick 版本
                </label>
                <div className="flex items-center gap-3">
                  <Select
                    value={settings.imagemagick_version}
                    onValueChange={(value) =>
                      setLocalSettings({
                        ...settings,
                        imagemagick_version: value as "v6" | "v7",
                      })
                    }
                  >
                    <SelectTrigger
                      className="w-40"
                      disabled={!settings.imagemagick_enabled}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="v7">v7 (magick)</SelectItem>
                      <SelectItem value="v6">v6 (convert)</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    onClick={handleTestImageMagick}
                    disabled={testingImageMagick}
                  >
                    {testingImageMagick ? "测试中..." : "测试命令可用性"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <div className="space-y-4">
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? "保存中..." : "保存设置"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
