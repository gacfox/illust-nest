import * as React from "react";
import { toast } from "sonner";

import { systemService } from "@/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InitPage() {
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
        toast.success("初始化成功", {
          description: "3秒后跳转到登录页",
        });
        redirectToLogin(redirectDelayMs);
      } else {
        toast.error(res.data.message || "初始化失败", {
          description: "3秒后跳转到登录页",
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
          : "初始化失败";

      toast.error(message, {
        description: "3秒后跳转到登录页",
      });
      redirectToLogin(redirectDelayMs);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-foreground">
            Illust Nest
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            初始化您的画廊系统
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                type="text"
                required
                minLength={3}
                maxLength={50}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                maxLength={100}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "处理中..." : "初始化"}
          </Button>
        </form>
      </div>
    </div>
  );
}
