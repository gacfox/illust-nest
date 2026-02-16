import { useEffect } from "react";
import { Link } from "react-router-dom";

type PublicLayoutProps = {
  title: string;
  siteTitle?: string;
  children: React.ReactNode;
};

export function PublicLayout({
  title,
  siteTitle = "Illust Nest",
  children,
}: PublicLayoutProps) {
  useEffect(() => {
    document.title = `${title} - ${siteTitle}`;
  }, [title, siteTitle]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/public/works" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
              IN
            </div>
            <span className="text-sm font-semibold">{siteTitle}</span>
          </Link>
          <div className="text-sm text-muted-foreground">{title}</div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
