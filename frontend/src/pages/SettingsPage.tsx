import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { systemService, authService } from "@/services";
import { useAuthStore, useI18nStore, useSystemStore } from "@/stores";
import type { SystemSettings } from "@/types/api";
import { CircleHelp, KeyRound } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const language = useI18nStore((state) => state.language);
  const setLanguage = useI18nStore((state) => state.setLanguage);
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

  // Password reset state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

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
      console.error(t("settings.loadFailed"), err);
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
        toast.success(t("settings.saveSuccess"));
      } else {
        toast.error(res.data.message || t("settings.saveFailed"));
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || t("settings.saveFailed"));
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
          t("settings.testSuccess", {
            command: res.data.data.command,
            message: res.data.data.message,
          }),
        );
      } else {
        toast.error(res.data.message || t("settings.testFailed"));
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || t("settings.testFailed"));
    } finally {
      setTestingImageMagick(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      toast.error(t("settings.passwordMinLength"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("settings.passwordMismatch"));
      return;
    }

    setResettingPassword(true);
    try {
      const res = await authService.resetPassword({
        new_password: newPassword,
      });
      if (res.data.code === 0) {
        toast.success(t("settings.resetPasswordSuccess"));
        setPasswordDialogOpen(false);
        setNewPassword("");
        setConfirmPassword("");
        // Clear auth and redirect to login
        clearAuth();
        localStorage.removeItem("token");
        navigate("/login");
      } else {
        toast.error(res.data.message || t("settings.resetPasswordFailed"));
      }
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || t("settings.resetPasswordFailed"),
      );
    } finally {
      setResettingPassword(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout
        title={t("settings.title")}
        breadcrumbs={[{ label: t("settings.title") }]}
        onLogout={handleLogout}
      >
        <div className="text-center text-muted-foreground">
          {t("app.loading")}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={t("settings.title")}
      breadcrumbs={[{ label: t("settings.title") }]}
      onLogout={handleLogout}
    >
      <div className="max-w-2xl">
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-medium text-foreground mb-4">
              {t("settings.section")}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t("settings.siteTitle")}
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
                  {t("settings.publicGalleryEnabled")}
                </label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 rounded-full text-muted-foreground"
                        aria-label={t("settings.publicGalleryAriaLabel")}
                      >
                        <CircleHelp className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6}>
                      {t("settings.publicGalleryHelp")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t("settings.language")}
                </label>
                <Select
                  value={language}
                  onValueChange={(value) =>
                    setLanguage(value as "zh-CN" | "zh-TW" | "en-US" | "ja-JP")
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zh-CN">
                      {t("settings.languageZhCN")}
                    </SelectItem>
                    <SelectItem value="zh-TW">
                      {t("settings.languageZhTW")}
                    </SelectItem>
                    <SelectItem value="en-US">
                      {t("settings.languageEnUS")}
                    </SelectItem>
                    <SelectItem value="ja-JP">
                      {t("settings.languageJaJP")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-medium text-foreground">
                {t("settings.imageMagickSection")}
              </h2>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 rounded-full text-muted-foreground"
                      aria-label={t("settings.imageMagickAriaLabel")}
                    >
                      <CircleHelp className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>
                    {t("settings.imageMagickHelp")}
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
                  {t("settings.imageMagickEnabled")}
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t("settings.imageMagickVersion")}
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
                    {testingImageMagick
                      ? t("settings.testing")
                      : t("settings.testCommand")}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-medium text-foreground mb-4">
              {t("settings.passwordSection")}
            </h2>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t("settings.resetPasswordDescription")}
              </p>
              <Dialog
                open={passwordDialogOpen}
                onOpenChange={setPasswordDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <KeyRound className="h-4 w-4" />
                    {t("settings.changePassword")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("settings.resetPassword")}</DialogTitle>
                    <DialogDescription>
                      {t("settings.resetPasswordDescription")}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">
                        {t("settings.newPassword")}
                      </Label>
                      <Input
                        id="new-password"
                        type="password"
                        placeholder={t("settings.newPasswordPlaceholder")}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">
                        {t("settings.confirmPassword")}
                      </Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        placeholder={t("settings.confirmPasswordPlaceholder")}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPasswordDialogOpen(false);
                        setNewPassword("");
                        setConfirmPassword("");
                      }}
                      disabled={resettingPassword}
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      onClick={handleResetPassword}
                      disabled={
                        resettingPassword || !newPassword || !confirmPassword
                      }
                    >
                      {resettingPassword
                        ? t("settings.resetting")
                        : t("settings.resetPassword")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <div className="space-y-4">
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? t("settings.saving") : t("settings.save")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
