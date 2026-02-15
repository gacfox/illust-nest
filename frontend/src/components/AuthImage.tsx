import { useEffect, useState } from "react";
import { imageService } from "@/services";

type AuthImageProps = {
  path: string;
  alt: string;
  className?: string;
  variant?: "thumbnail" | "original" | "transcoded";
};

export function AuthImage({
  path,
  alt,
  className,
  variant = "thumbnail",
}: AuthImageProps) {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
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
  }, [path, variant]);

  if (!src) {
    return (
      <div
        className={[
          "bg-muted flex items-center justify-center text-xs text-muted-foreground",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        加载中
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} />;
}
