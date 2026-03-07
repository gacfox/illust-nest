import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 text-foreground">
      <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:gap-6">
        <div className="text-4xl font-medium tracking-tight sm:text-5xl">
          {t("notFound.title")}
        </div>
        <div className="hidden h-10 w-px bg-border sm:block" />
        <div className="space-y-2">
          <p className="text-base text-muted-foreground sm:text-lg">
            {t("notFound.message")}
          </p>
          <Link
            to="/"
            className="inline-block text-sm text-foreground underline underline-offset-4 hover:text-muted-foreground"
          >
            {t("notFound.backHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
