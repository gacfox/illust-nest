import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 text-foreground">
      <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:gap-6">
        <div className="text-4xl font-medium tracking-tight sm:text-5xl">
          404
        </div>
        <div className="hidden h-10 w-px bg-border sm:block" />
        <div className="space-y-2">
          <p className="text-base text-muted-foreground sm:text-lg">
            抱歉，未找到你访问的页面。
          </p>
          <Link
            to="/"
            className="inline-block text-sm text-foreground underline underline-offset-4 hover:text-muted-foreground"
          >
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
