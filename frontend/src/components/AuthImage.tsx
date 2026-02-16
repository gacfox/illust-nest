import { useEffect, useRef, useState } from "react";
import { imageService } from "@/services";

type AuthImageProps = {
  path: string;
  alt: string;
  className?: string;
  variant?: "thumbnail" | "original" | "transcoded";
  lazy?: boolean;
};

export function AuthImage({
  path,
  alt,
  className,
  variant = "thumbnail",
  lazy = false,
}: AuthImageProps) {
  const [src, setSrc] = useState<string>("");
  const [shouldLoad, setShouldLoad] = useState<boolean>(!lazy);
  const placeholderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setShouldLoad(!lazy);
  }, [path, variant, lazy]);

  useEffect(() => {
    if (!lazy) {
      return;
    }
    const el = placeholderRef.current;
    if (!el) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observer.disconnect();
            return;
          }
        }
      },
      { rootMargin: "120px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [lazy, path, variant]);

  useEffect(() => {
    if (!shouldLoad) {
      return;
    }
    let revoked = false;
    let objectUrl = "";

    const fetchImage = async () => {
      try {
        const res =
          variant === "original"
            ? await imageService.fetchOriginal(path)
            : variant === "transcoded"
              ? await imageService.fetchTranscoded(path)
              : await imageService.fetchThumbnail(path);
        objectUrl = URL.createObjectURL(res.data);
        if (!revoked) {
          setSrc(objectUrl);
        }
      } catch (err) {
        console.error("加载图片失败", err);
      }
    };

    fetchImage();

    return () => {
      revoked = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [path, variant, shouldLoad]);

  if (!src) {
    return (
      <div
        ref={placeholderRef}
        className={[
          "bg-muted flex items-center justify-center text-xs text-muted-foreground",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {shouldLoad ? "加载中" : "待加载"}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={lazy ? "lazy" : undefined}
    />
  );
}
