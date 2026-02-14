import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useAuthStore, useSystemStore } from "@/stores";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import {
  Images,
  FolderKanban,
  Tags,
  Settings,
  ChevronLeft,
  Menu,
  UserCircle2,
  LogOut,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type AdminLayoutProps = {
  title: string;
  breadcrumbs: BreadcrumbItem[];
  children: React.ReactNode;
  onLogout?: () => void;
};

const navItems = [
  { to: "/", label: "作品管理", icon: Images },
  { to: "/collections", label: "作品集管理", icon: FolderKanban },
  { to: "/tags", label: "标签管理", icon: Tags },
  { to: "/settings", label: "系统设置", icon: Settings },
];

function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {items.map((item, index) => (
        <span
          key={`${item.label}-${index}`}
          className="flex items-center gap-2"
        >
          {item.href ? (
            <a href={item.href} className="hover:text-foreground">
              {item.label}
            </a>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
          {index < items.length - 1 && <span>/</span>}
        </span>
      ))}
    </div>
  );
}

export function AdminLayout({
  title,
  breadcrumbs,
  children,
  onLogout,
}: AdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(() => {
    const stored = localStorage.getItem("sidebar_collapsed");
    return stored === "true";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const systemSettings = useSystemStore((state) => state.settings);
  const siteTitle = systemSettings?.site_title || "Illust Nest";
  const { theme, resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    document.title = `${title} - ${siteTitle}`;
  }, [title, siteTitle]);

  const toggleTheme = () => {
    const order: ("system" | "light" | "dark")[] = ["system", "light", "dark"];
    const currentIndex = order.indexOf(theme);
    const nextIndex = (currentIndex + 1) % order.length;
    setTheme(order[nextIndex]);
  };

  const getThemeIcon = (size: string = "h-4 w-4") => {
    if (theme === "system") {
      return <Monitor className={size} />;
    }
    return resolvedTheme === "dark" ? (
      <Moon className={size} />
    ) : (
      <Sun className={size} />
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-card border-b border-border flex items-center justify-between px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(true)}
          aria-label="打开菜单"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="text-sm font-semibold">{title}</div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label="切换主题"
        >
          {getThemeIcon()}
        </Button>
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-card border-r border-border p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="font-bold">{siteTitle}</div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                aria-label="关闭菜单"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      [
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                        isActive
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent",
                      ].join(" ")
                    }
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      <div className="flex">
        <aside
          className={[
            "hidden lg:flex h-screen sticky top-0 border-r border-border bg-card flex-col transition-all",
            collapsed ? "w-16" : "w-60",
          ].join(" ")}
        >
          <div className="h-16 flex items-center justify-between px-4">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                IN
              </div>
              {!collapsed && <span className="font-semibold">{siteTitle}</span>}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              aria-label="折叠菜单"
            >
              <ChevronLeft
                className={[
                  "h-4 w-4 transition-transform",
                  collapsed ? "rotate-180" : "",
                ].join(" ")}
              />
            </Button>
          </div>
          <nav className="px-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                      isActive
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent",
                    ].join(" ")
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          <header className="hidden lg:flex h-16 border-b border-border bg-card items-center justify-between px-6">
            <Breadcrumbs items={breadcrumbs} />
            <div className="flex items-center gap-3 text-sm">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                aria-label="切换主题"
              >
                {getThemeIcon("h-5 w-5")}
              </Button>
              <div className="flex items-center gap-2 text-muted-foreground">
                <UserCircle2 className="h-5 w-5" />
                <span className="text-foreground">
                  {user?.username || "管理员"}
                </span>
              </div>
              {onLogout && (
                <Button variant="ghost" size="sm" onClick={onLogout}>
                  <LogOut className="h-4 w-4 mr-1" />
                  退出
                </Button>
              )}
            </div>
          </header>

          <main className="px-4 py-6 lg:px-6 lg:py-8">
            <h1 className="text-2xl font-semibold mb-6">{title}</h1>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
