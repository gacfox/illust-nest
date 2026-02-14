import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { AdminLayout } from "@/components/AdminLayout";
import { AuthImage } from "@/components/AuthImage";
import { collectionService, workService } from "@/services";
import type { Collection, Image, Tag, Work } from "@/types/api";
import { useAuthStore } from "@/stores";
import {
  Star,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  Check,
  Pencil,
  Trash2,
  Link2,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

function normalizePublicImagePath(path: string, isThumbnail: boolean) {
  if (!path) return "";
  let cleaned = path.startsWith("/") ? path.slice(1) : path;
  const prefix = isThumbnail ? "uploads/thumbnails/" : "uploads/originals/";
  if (cleaned.startsWith(prefix)) {
    cleaned = cleaned.slice(prefix.length);
  }
  const apiPrefix = isThumbnail
    ? "/api/public/images/thumbnails"
    : "/api/public/images/originals";
  return `${apiPrefix}/${cleaned}`;
}

export function WorkPreviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<number[]>(
    [],
  );
  const [initialSelectedCollectionIds, setInitialSelectedCollectionIds] =
    useState<number[]>([]);
  const [addingToCollection, setAddingToCollection] = useState(false);
  const [collectionError, setCollectionError] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const lightboxStageRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingOffset = useRef({ x: 0, y: 0 });
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(
    new Map(),
  );
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef(1);
  const pinchStartOffsetRef = useRef({ x: 0, y: 0 });
  const pinchStartCenterRef = useRef({ x: 0, y: 0 });

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
    setDeleting(true);
    try {
      await workService.delete(workId);
      setDeleteDialogOpen(false);
      navigate("/");
    } catch (err) {
      console.error("删除失败", err);
    } finally {
      setDeleting(false);
    }
  };

  const loadCollections = async () => {
    if (!workId) {
      return;
    }

    setCollectionsLoading(true);
    setCollectionError("");
    try {
      const [treeRes, selectedRes] = await Promise.all([
        collectionService.getTree(),
        collectionService.getByWork(workId),
      ]);

      if (treeRes.data.code !== 0) {
        setCollections([]);
        setCollectionError(treeRes.data.message || "加载作品集失败");
        return;
      }

      const data = treeRes.data.data as Collection[] | { items?: Collection[] };
      const items = Array.isArray(data) ? data : (data.items ?? []);
      setCollections(items);

      if (selectedRes.data.code === 0) {
        const selectedItems = selectedRes.data.data?.items ?? [];
        const ids = selectedItems.map((item) => item.id);
        setSelectedCollectionIds(ids);
        setInitialSelectedCollectionIds(ids);
      } else {
        setSelectedCollectionIds([]);
        setInitialSelectedCollectionIds([]);
      }
    } catch (error) {
      console.error("加载作品集失败", error);
      setCollections([]);
      setCollectionError("加载作品集失败");
    } finally {
      setCollectionsLoading(false);
    }
  };

  const openAddToCollectionDialog = async () => {
    setCollectionDialogOpen(true);
    await loadCollections();
  };

  const handleAddToCollection = async () => {
    if (!work?.id) {
      return;
    }

    const toAdd = selectedCollectionIds.filter(
      (id) => !initialSelectedCollectionIds.includes(id),
    );
    const toRemove = initialSelectedCollectionIds.filter(
      (id) => !selectedCollectionIds.includes(id),
    );

    if (toAdd.length === 0 && toRemove.length === 0) {
      setCollectionDialogOpen(false);
      return;
    }

    setAddingToCollection(true);
    setCollectionError("");
    try {
      const response = await collectionService.syncByWork(work.id as number, {
        collection_ids: selectedCollectionIds,
      });
      if (response.data.code !== 0) {
        setCollectionError(response.data.message || "更新作品集失败");
        return;
      }

      setCollectionDialogOpen(false);
      const addedCount = toAdd.length;
      const removedCount = toRemove.length;
      if (addedCount > 0 && removedCount > 0) {
        toast.success(
          `已更新作品集（新增 ${addedCount}，移除 ${removedCount}）`,
        );
      } else if (addedCount > 0) {
        toast.success(`已新增到 ${addedCount} 个作品集`);
      } else {
        toast.success(`已从 ${removedCount} 个作品集中移除`);
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
          : "更新作品集失败";
      setCollectionError(message);
    } finally {
      setAddingToCollection(false);
    }
  };

  const hasCollectionSelectionChanged =
    selectedCollectionIds.length !== initialSelectedCollectionIds.length ||
    selectedCollectionIds.some(
      (id) => !initialSelectedCollectionIds.includes(id),
    ) ||
    initialSelectedCollectionIds.some(
      (id) => !selectedCollectionIds.includes(id),
    );

  const handleToggleCollection = (collectionId: number) => {
    setSelectedCollectionIds((prev) =>
      prev.includes(collectionId)
        ? prev.filter((id) => id !== collectionId)
        : [...prev, collectionId],
    );
  };

  const collectionDialogConfirmText = addingToCollection ? "保存中..." : "保存";

  const images = useMemo(() => work?.images ?? [], [work]);
  const visibleImages = showAll ? images : images.slice(0, 1);
  const activeImage = images[lightboxIndex];
  const previewSource = location.state as
    | {
        from?: string;
        collectionId?: number;
        collectionName?: string;
      }
    | undefined;
  const isFromCollection = previewSource?.from === "collections";
  const collectionNameFromSource =
    typeof previewSource?.collectionName === "string" &&
    previewSource.collectionName.trim() !== ""
      ? previewSource.collectionName
      : "作品集";
  const publicImageLinks = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return images
      .map((img) => {
        const isThumbnail = !img.original_path && !!img.thumbnail_path;
        const rawPath = img.original_path || img.thumbnail_path;
        const normalized = normalizePublicImagePath(rawPath, isThumbnail);
        if (!normalized) {
          return "";
        }
        return origin ? `${origin}${normalized}` : normalized;
      })
      .filter((item) => item !== "");
  }, [images]);

  const writeToClipboard = async (text: string) => {
    if (!text) {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  };

  const resetTransform = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const clearPointerState = () => {
    activePointersRef.current.clear();
    pinchStartDistanceRef.current = null;
  };

  const getPointerMetrics = (pointers: { x: number; y: number }[]) => {
    const [p1, p2] = pointers;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return {
      distance: Math.hypot(dx, dy),
      center: {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2,
      },
    };
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
    resetTransform();
    clearPointerState();
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    resetTransform();
    setDragging(false);
    clearPointerState();
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
      breadcrumbs={
        isFromCollection
          ? [
              { label: "作品集管理", href: "/collections" },
              {
                label: collectionNameFromSource,
                href:
                  typeof previewSource?.collectionId === "number" &&
                  previewSource.collectionId > 0
                    ? `/collections/${previewSource.collectionId}/works`
                    : "/collections",
              },
              { label: work?.title || "作品预览" },
            ]
          : [
              { label: "作品管理", href: "/" },
              { label: work?.title || "作品预览" },
            ]
      }
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
                        path={img.original_path || img.thumbnail_path}
                        alt={work?.title ?? ""}
                        variant={img.original_path ? "original" : "thumbnail"}
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

            {work.is_public && publicImageLinks.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  图片链接（公开）
                </div>
                <div className="flex flex-wrap gap-2">
                  {publicImageLinks.map((link, index) => (
                    <Badge
                      key={`${link}-${index}`}
                      variant="secondary"
                      className="cursor-pointer select-none"
                      onClick={async () => {
                        await writeToClipboard(link);
                        toast.success(`已复制图片链接 ${index + 1}`);
                      }}
                    >
                      <Link2 className="h-3.5 w-3.5 mr-1" />
                      复制链接 P{index + 1}
                    </Badge>
                  ))}
                  {publicImageLinks.length > 1 && (
                    <Badge
                      variant="secondary"
                      className="cursor-pointer select-none"
                      onClick={async () => {
                        await writeToClipboard(publicImageLinks.join("\n"));
                        toast.success(
                          `已复制全部链接（${publicImageLinks.length} 条）`,
                        );
                      }}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      复制全部
                    </Badge>
                  )}
                </div>
              </div>
            )}

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
              <Button variant="outline" onClick={openAddToCollectionDialog}>
                <FolderPlus className="h-4 w-4 mr-1" />
                作品集
              </Button>
              <Button
                onClick={() =>
                  navigate(`/works/${work.id}`, {
                    state: previewSource,
                  })
                }
              >
                <Pencil className="h-4 w-4 mr-1" />
                编辑
              </Button>
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                删除
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={collectionDialogOpen}
        onOpenChange={(open) => {
          setCollectionDialogOpen(open);
          if (!open) {
            setCollectionError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>加入作品集</DialogTitle>
            <DialogDescription>
              可多选作品集，已加入的作品集会自动勾选
            </DialogDescription>
          </DialogHeader>

          {collectionError && (
            <div className="text-sm text-destructive">{collectionError}</div>
          )}

          <div className="max-h-72 overflow-y-auto rounded-md border border-border">
            {collectionsLoading ? (
              <div className="p-4 text-sm text-muted-foreground">加载中...</div>
            ) : collections.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                暂无可用作品集
              </div>
            ) : (
              <div className="divide-y divide-border">
                {collections.map((collection) => {
                  const selected = selectedCollectionIds.includes(
                    collection.id,
                  );
                  return (
                    <button
                      key={collection.id}
                      type="button"
                      onClick={() => handleToggleCollection(collection.id)}
                      className={[
                        "w-full px-3 py-2 text-left flex items-center justify-between",
                        selected
                          ? "bg-accent text-foreground"
                          : "hover:bg-accent/60 text-foreground",
                      ].join(" ")}
                    >
                      <div>
                        <div className="text-sm font-medium">
                          {collection.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {collection.work_count} 项作品
                        </div>
                      </div>
                      {selected && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCollectionDialogOpen(false)}
              disabled={addingToCollection}
            >
              取消
            </Button>
            <Button
              onClick={handleAddToCollection}
              disabled={
                addingToCollection ||
                collectionsLoading ||
                collections.length === 0 ||
                !hasCollectionSelectionChanged
              }
            >
              {collectionDialogConfirmText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!deleting) {
            setDeleteDialogOpen(open);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除作品？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后将无法恢复该作品及其关联图片。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            className="absolute inset-0 z-10 flex touch-none items-center justify-center"
            onDragStart={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              e.preventDefault();
              if ((e.target as HTMLElement).tagName === "BUTTON") {
                return;
              }
              activePointersRef.current.set(e.pointerId, {
                x: e.clientX,
                y: e.clientY,
              });
              e.currentTarget.setPointerCapture(e.pointerId);
              const pointers = Array.from(activePointersRef.current.values());
              if (pointers.length === 1) {
                setDragging(true);
                dragStart.current = {
                  x: e.clientX - offset.x,
                  y: e.clientY - offset.y,
                };
                pinchStartDistanceRef.current = null;
                return;
              }
              if (pointers.length === 2) {
                const { distance, center } = getPointerMetrics(pointers);
                pinchStartDistanceRef.current = distance;
                pinchStartZoomRef.current = zoom;
                pinchStartOffsetRef.current = offset;
                pinchStartCenterRef.current = center;
                setDragging(false);
              }
            }}
            onPointerMove={(e) => {
              if (!activePointersRef.current.has(e.pointerId)) return;
              activePointersRef.current.set(e.pointerId, {
                x: e.clientX,
                y: e.clientY,
              });

              const pointers = Array.from(activePointersRef.current.values());
              if (pointers.length === 2 && pinchStartDistanceRef.current) {
                const { distance, center } = getPointerMetrics(pointers);
                const scale = distance / pinchStartDistanceRef.current;
                const nextZoom = Math.min(
                  3,
                  Math.max(1, pinchStartZoomRef.current * scale),
                );
                setZoom(nextZoom);
                setOffset({
                  x:
                    pinchStartOffsetRef.current.x +
                    (center.x - pinchStartCenterRef.current.x),
                  y:
                    pinchStartOffsetRef.current.y +
                    (center.y - pinchStartCenterRef.current.y),
                });
                return;
              }

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
            onPointerUp={(e) => {
              activePointersRef.current.delete(e.pointerId);
              const pointers = Array.from(activePointersRef.current.values());
              if (pointers.length === 1) {
                const [point] = pointers;
                setDragging(true);
                dragStart.current = {
                  x: point.x - offset.x,
                  y: point.y - offset.y,
                };
                pinchStartDistanceRef.current = null;
                return;
              }
              setDragging(false);
              pinchStartDistanceRef.current = null;
            }}
            onPointerCancel={(e) => {
              activePointersRef.current.delete(e.pointerId);
              if (activePointersRef.current.size === 0) {
                setDragging(false);
                pinchStartDistanceRef.current = null;
              }
            }}
            onLostPointerCapture={(e) => {
              activePointersRef.current.delete(e.pointerId);
              if (activePointersRef.current.size === 0) {
                setDragging(false);
                pinchStartDistanceRef.current = null;
              }
            }}
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
