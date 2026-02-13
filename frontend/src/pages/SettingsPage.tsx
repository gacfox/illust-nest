import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { systemService } from "@/services";
import { useAuthStore, useSystemStore } from "@/stores";
import type { SystemSettings } from "@/types/api";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export function SettingsPage() {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const systemSettings = useSystemStore((state) => state.settings);
  const setSettings = useSystemStore((state) => state.setSettings);

  const [settings, setLocalSettings] = useState<SystemSettings>({
    public_gallery_enabled: false,
    site_title: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

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
    setMessage("");
    try {
      const res = await systemService.updateSettings(settings);
      if (res.data.code === 0) {
        setSettings(settings);
        setMessage("设置已保存");
      } else {
        setMessage(res.data.message);
      }
    } catch (err: any) {
      setMessage(err.response?.data?.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    localStorage.removeItem("token");
    navigate("/login");
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
          {message && (
            <div className="bg-primary/10 text-primary px-4 py-3 rounded-lg text-sm">
              {message}
            </div>
          )}

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
