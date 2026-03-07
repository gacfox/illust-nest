import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { systemService } from "@/services";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InitPage() {
  const { t } = useTranslation();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const redirectTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  React.useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const redirectToLogin = (delayMs: number) => {
    redirectTimerRef.current = setTimeout(() => {
      window.location.href = "/login";
    }, delayMs);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const redirectDelayMs = 3000;

    try {
      const res = await systemService.init({ username, password });
      if (res.data.code === 0) {
        toast.success(t("init.success"), {
          description: t("init.redirecting", { seconds: 3 }),
        });
        redirectToLogin(redirectDelayMs);
      } else {
        toast.error(res.data.message || t("init.failed"), {
          description: t("init.redirecting", { seconds: 3 }),
        });
        redirectToLogin(redirectDelayMs);
      }
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } })
          .response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response!
              .data!.message!
          : t("init.failed");

      toast.error(message, {
        description: t("init.redirecting", { seconds: 3 }),
      });
      redirectToLogin(redirectDelayMs);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-8 text-foreground sm:px-6 md:px-8">
      <Card className="w-full max-w-sm sm:max-w-md md:max-w-lg">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl sm:text-3xl">
            {t("init.title")}
          </CardTitle>
          <CardDescription>{t("init.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">{t("auth.username")}</Label>
                <Input
                  id="username"
                  type="text"
                  required
                  minLength={3}
                  maxLength={50}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  maxLength={100}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <CardFooter className="px-0 pt-1">
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? t("init.processing") : t("init.initializing")}
              </Button>
            </CardFooter>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
