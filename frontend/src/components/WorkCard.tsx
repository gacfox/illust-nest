import type { ReactNode } from "react";
import { Layers } from "lucide-react";

import { AuthImage } from "@/components/AuthImage";
import { Badge } from "@/components/ui/badge";
import type { Work } from "@/types/api";

type WorkCardProps = {
  work: Work;
  onPreview: () => void;
  topLeftOverlay?: ReactNode;
  bottomLeftOverlay?: ReactNode;
  showPublicBadge?: boolean;
};

export function WorkCard({
  work,
  onPreview,
  topLeftOverlay,
  bottomLeftOverlay,
  showPublicBadge = false,
}: WorkCardProps) {
  const tagNames = work.tags?.map((tag) => tag.name) ?? [];
  const adultBadge = tagNames.includes("R18G")
    ? "R18G"
    : tagNames.includes("R18")
      ? "R18"
      : null;

  return (
    <div className="group bg-card border border-border rounded-lg overflow-hidden hover:shadow-lg transition-shadow w-full">
      <div className="relative">
        {topLeftOverlay && (
          <div className="absolute top-2 left-2 z-10">{topLeftOverlay}</div>
        )}
        {bottomLeftOverlay && (
          <div className="absolute bottom-3.5 left-2 z-10">
            {bottomLeftOverlay}
          </div>
        )}

        {work.cover_image ? (
          <button className="w-full" onClick={onPreview}>
            <AuthImage
              path={work.cover_image.thumbnail_path}
              alt={work.title}
              className="w-full h-55 object-cover"
            />
          </button>
        ) : (
          <div
            className="w-full h-55 bg-muted flex items-center justify-center text-muted-foreground text-sm cursor-pointer"
            onClick={onPreview}
          >
            无封面
          </div>
        )}

        {(adultBadge || (showPublicBadge && work.is_public)) && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5">
            {showPublicBadge && work.is_public && (
              <Badge className="border-0 bg-black/55 text-white hover:bg-black/65">
                公开
              </Badge>
            )}
            {adultBadge && (
              <Badge className="bg-pink-500 text-white hover:bg-pink-500/90">
                {adultBadge}
              </Badge>
            )}
          </div>
        )}

        {typeof work.image_count === "number" && work.image_count > 1 && (
          <div className="absolute bottom-3.5 right-2">
            <div className="flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-xs text-white">
              <Layers className="h-3.5 w-3.5" />
              {work.image_count}
            </div>
          </div>
        )}
      </div>
      <div className="p-2">
        <h3 className="font-semibold text-foreground truncate">{work.title}</h3>
      </div>
    </div>
  );
}
