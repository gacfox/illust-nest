import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { AdminLayout } from "@/components/AdminLayout";
import { AuthImage } from "@/components/AuthImage";
import { workService } from "@/services";
import type { Image, Tag, Work } from "@/types/api";
import { useAuthStore } from "@/stores";
import {
  Star,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type WorkDetail = Work & {
  images?: Image[];
  tags?: Tag[];
};

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function WorkPreviewPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const workId = Number(id);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [loading, setLoading] = useState(true);
  const [work, setWork] = useState<WorkDetail | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const lightboxStageRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!workId) {
      navigate("/");
      return;
    }
    const load = async () => {
      try {
        const res = await workService.get(workId);
        if (res.data.code === 0) {
          setWork(res.data.data as WorkDetail);
        }
      } catch (err) {
        console.error("加载作品失败", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [workId, navigate]);

  const handleLogout = () => {
    clearAuth();
    localStorage.removeItem("token");
    navigate("/login");
  };

  const handleDelete = async () => {
    if (!workId) return;
    if (!window.confirm("确认删除该作品吗？")) return;
    try {
      await workService.delete(workId);
      navigate("/");
    } catch (err) {
      console.error("删除失败", err);
    }
  };

  const images = useMemo(() => work?.images ?? [], [work]);
  const visibleImages = showAll ? images : images.slice(0, 1);
  const activeImage = images[lightboxIndex];

  const resetTransform = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
    resetTransform();
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    resetTransform();
  };

  const goPrev = () => {
    setLightboxIndex((prev) => Math.max(prev - 1, 0));
    resetTransform();
  };

  const goNext = () => {
    setLightboxIndex((prev) => Math.min(prev + 1, images.length - 1));
    resetTransform();
  };

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    const stage = lightboxStageRef.current;
    if (stage) {
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom((z) => Math.min(3, Math.max(1, z + delta)));
      };
      stage.addEventListener("wheel", onWheel, { passive: false });
      return () => {
        document.removeEventListener("keydown", onKey);
        document.body.style.overflow = "";
        stage.removeEventListener("wheel", onWheel);
      };
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightboxOpen, images.length]);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <AdminLayout
      title="作品预览"
      breadcrumbs={[
        { label: "作品管理", href: "/" },
        { label: work?.title || "作品预览" },
      ]}
      onLogout={handleLogout}
    >
      {loading ? (
        <div className="text-center text-muted-foreground">加载中...</div>
      ) : !work ? (
        <div className="text-center text-muted-foreground">作品不存在</div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-4">
            {visibleImages.length > 0 ? (
              visibleImages.map((img, index) => (
                <div
                  key={img.id}
                  className="bg-card border border-border rounded-lg overflow-hidden"
                >
                  <div className="relative">
                    <Button
                      variant="ghost"
                      className="w-full h-auto p-0"
                      onClick={() => openLightbox(showAll ? index : 0)}
                    >
                      <AuthImage
                        path={img.thumbnail_path}
                        alt={work?.title ?? ""}
                        className="w-full max-h-155 object-contain bg-muted"
                      />
                    </Button>
                    {!showAll && images.length > 1 && index === 0 && (
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setShowAll(true)}
                          className="bg-black/60 text-white hover:bg-black/70"
                        >
                          查看全部
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-card border border-border rounded-lg p-6 text-center text-muted-foreground">
                无图片
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-lg p-6 space-y-5">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">
                {work.title}
              </h2>
              {work.description ? (
                <div className="markdown-body mt-2 text-sm leading-relaxed">
                  <ReactMarkdown>{work.description}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-2">无描述</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {work.tags?.length ? (
                work.tags.map((tag) => (
                  <Badge key={tag.id} variant="secondary">
                    {tag.name}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">无标签</span>
              )}
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="text-foreground">评分</span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star
                      key={`star-${index}`}
                      className={[
                        "h-4 w-4",
                        index < work.rating
                          ? "fill-primary text-primary"
                          : "text-muted-foreground",
                      ].join(" ")}
                    />
                  ))}
                </div>
                <span className="text-xs">({work.rating}/5)</span>
              </div>
              <div>创建时间：{formatDateTime(work.created_at)}</div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={() => navigate(`/works/${work.id}`)}>
                编辑
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                删除
              </Button>
            </div>
          </div>
        </div>
      )}

      {lightboxOpen && activeImage && (
        <div className="fixed inset-0 z-50 bg-black/80">
          <div className="absolute top-4 right-4 z-20 flex gap-2">
            <button
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              className="p-2 bg-white/10 text-white rounded-md hover:bg-white/20"
              aria-label="放大"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
              className="p-2 bg-white/10 text-white rounded-md hover:bg-white/20"
              aria-label="缩小"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              onClick={resetTransform}
              className="p-2 bg-white/10 text-white rounded-md hover:bg-white/20"
              aria-label="还原"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={closeLightbox}
              className="p-2 bg-white/10 text-white rounded-md hover:bg-white/20"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={goPrev}
            disabled={lightboxIndex === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 disabled:opacity-40"
            aria-label="上一张"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={goNext}
            disabled={lightboxIndex === images.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 disabled:opacity-40"
            aria-label="下一张"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div
            ref={lightboxStageRef}
            className="absolute inset-0 z-10 flex items-center justify-center"
            onDragStart={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              e.preventDefault();
              if ((e.target as HTMLElement).tagName === "BUTTON") {
                return;
              }
              e.currentTarget.setPointerCapture(e.pointerId);
              setDragging(true);
              dragStart.current = {
                x: e.clientX - offset.x,
                y: e.clientY - offset.y,
              };
            }}
            onPointerMove={(e) => {
              if (!dragging) return;
              pendingOffset.current = {
                x: e.clientX - dragStart.current.x,
                y: e.clientY - dragStart.current.y,
              };
              if (!rafRef.current) {
                rafRef.current = requestAnimationFrame(() => {
                  setOffset(pendingOffset.current);
                  rafRef.current = null;
                });
              }
            }}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
            onLostPointerCapture={() => setDragging(false)}
          >
            <div
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              }}
              className="max-h-[90vh] max-w-[90vw] will-change-transform"
            >
              <AuthImage
                path={activeImage.original_path || activeImage.thumbnail_path}
                alt={work?.title ?? ""}
                variant={activeImage.original_path ? "original" : "thumbnail"}
                className="max-h-[90vh] max-w-[90vw] object-contain pointer-events-none select-none"
              />
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
