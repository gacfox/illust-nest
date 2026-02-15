import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { CircleHelp } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { tagService, workService } from "@/services";
import type { DuplicateImageInfo, Image, Tag, Work } from "@/types/api";
import { useAuthStore } from "@/stores";
import { AuthImage } from "@/components/AuthImage";

type WorkDetail = Work & {
  images?: Image[];
  tags?: Tag[];
};

type UploadItem = {
  file: File;
  previewUrl: string;
  imageHash: string;
  requiresTranscode: boolean;
};

export function WorkEditPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const workId = Number(id);
  const isNew = !id;
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [work, setWork] = useState<WorkDetail | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rating, setRating] = useState(0);
  const [isPublic, setIsPublic] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [newUploads, setNewUploads] = useState<UploadItem[]>([]);
  const [imageOrder, setImageOrder] = useState<number[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateImages, setDuplicateImages] = useState<DuplicateImageInfo[]>(
    [],
  );
  const editSource = location.state as
    | {
        from?: string;
        collectionId?: number;
        collectionName?: string;
      }
    | undefined;
  const isFromCollection = editSource?.from === "collections";
  const collectionNameFromSource =
    typeof editSource?.collectionName === "string" &&
    editSource.collectionName.trim() !== ""
      ? editSource.collectionName
      : "作品集";
  const collectionWorksHref =
    typeof editSource?.collectionId === "number" && editSource.collectionId > 0
      ? `/collections/${editSource.collectionId}/works`
      : "/collections";

  const loadData = useCallback(async () => {
    try {
      if (!isNew) {
        const workRes = await workService.get(workId);
        if (workRes.data.code === 0) {
          const detail = workRes.data.data as WorkDetail;
          setWork(detail);
          setTitle(detail.title);
          setDescription(detail.description || "");
          setRating(detail.rating || 0);
          setIsPublic(detail.is_public || false);
          setSelectedTagIds(detail.tags?.map((t) => t.id) ?? []);
          setImageOrder(detail.images?.map((img) => img.id) ?? []);
        }
      }

      const tagRes = await tagService.list();
      if (tagRes.data.code === 0) {
        const data = tagRes.data.data as any;
        const list = Array.isArray(data) ? data : (data?.items ?? []);
        setTags(list);
      }
    } catch (err) {
      console.error("加载作品失败", err);
      setError("加载作品失败");
    } finally {
      setLoading(false);
    }
  }, [workId, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      const imageFiles = Array.from(droppedFiles).filter((file) =>
        file.type.startsWith("image/"),
      );
      if (imageFiles.length === 0) {
        toast.error("请拖拽图片文件");
        return;
      }
      handleFiles(imageFiles);
    }
  };

  const handleLogout = () => {
    clearAuth();
    localStorage.removeItem("token");
    navigate("/login");
  };

  const handleFiles = (files: FileList | File[] | null) => {
    if (!files) {
      return;
    }
    void appendUploadsWithHash(Array.from(files));
  };

  const removeNewUpload = (index: number) => {
    setNewUploads((prev) => {
      const target = prev[index];
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const moveNewUpload = (from: number, to: number) => {
    setNewUploads((prev) => {
      const next = [...prev];
      const item = next.splice(from, 1)[0];
      next.splice(to, 0, item);
      return next;
    });
  };

  const moveImage = (from: number, to: number) => {
    setImageOrder((prev) => {
      const next = [...prev];
      const item = next.splice(from, 1)[0];
      next.splice(to, 0, item);
      return next;
    });
  };

  const orderedImages = useMemo(() => {
    if (!work?.images) return [];
    const map = new Map(work.images.map((img) => [img.id, img]));
    return imageOrder.map((id) => map.get(id)).filter(Boolean) as Image[];
  }, [work?.images, imageOrder]);

  const canSave =
    title.trim().length > 0 &&
    !saving &&
    (isNew ? newUploads.length > 0 : true) &&
    (isNew || work);

  const uploadHint = useMemo(() => {
    const uploadCount = isNew ? newUploads.length : newUploads.length;
    if (uploadCount === 0)
      return isNew ? "拖拽或点击上传图片（至少 1 张）" : "可添加新图片";
    return "可继续拖拽或点击添加更多图片";
  }, [newUploads.length, isNew]);

  const handleSave = async () => {
    if (!canSave) return;
    setError("");

    const passedDuplicateCheck = await confirmDuplicateImages();
    if (!passedDuplicateCheck) {
      return;
    }

    await executeSave();
  };

  const executeSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (isNew) {
        const formData = new FormData();
        formData.append("title", title.trim());
        if (description) formData.append("description", description);
        formData.append("rating", String(rating));
        formData.append("is_public", String(isPublic));
        if (selectedTagIds.length > 0) {
          formData.append("tag_ids", selectedTagIds.join(","));
        }
        newUploads.forEach((item) => {
          formData.append("images", item.file);
          formData.append("image_hashes", item.imageHash);
        });
        const createRes = await workService.create(formData);
        if (createRes.data.code !== 0) {
          toast.error(createRes.data.message || "创建作品失败");
          return;
        }
        const createdId = createRes.data.data?.id;
        if (createdId) {
          clearNewUploads();
          toast.success("作品创建成功");
          navigate(`/works/${createdId}`);
        } else {
          toast.success("作品创建成功");
          navigate("/");
        }
      } else {
        const updateRes = await workService.update(workId, {
          title: title.trim(),
          description,
          rating,
          is_public: isPublic,
          tag_ids: selectedTagIds,
        });
        if (updateRes.data.code !== 0) {
          toast.error(updateRes.data.message || "保存失败");
          return;
        }

        if (imageOrder.length > 0) {
          await workService.updateImageOrder(workId, imageOrder);
        }

        if (newUploads.length > 0) {
          const formData = new FormData();
          newUploads.forEach((item) => {
            formData.append("images", item.file);
            formData.append("image_hashes", item.imageHash);
          });
          const uploadRes = await workService.addImages(workId, formData);
          if (uploadRes.data.code !== 0) {
            toast.error(uploadRes.data.message || "上传图片失败");
            return;
          }
        }

        toast.success("作品保存成功", {
          description: "您的修改已成功保存",
        });

        clearNewUploads();
        await loadData();
      }
    } catch (err) {
      console.error("保存失败", err);
      toast.error("保存失败", {
        description: "请检查网络连接或稍后重试",
      });
    } finally {
      setSaving(false);
    }
  };

  const appendUploadsWithHash = async (files: File[]) => {
    try {
      const next = await Promise.all(
        files.map(async (file) => {
          const imageHash = await computeImageHash(file);
          return {
            file,
            previewUrl: URL.createObjectURL(file),
            imageHash,
            requiresTranscode: shouldShowTranscodePlaceholder(file),
          };
        }),
      );
      setNewUploads((prev) => [...prev, ...next]);
    } catch (err) {
      console.error("计算图片哈希失败", err);
      toast.error("计算图片哈希失败，请重试");
    }
  };

  const confirmDuplicateImages = async (): Promise<boolean> => {
    if (newUploads.length === 0) {
      return true;
    }

    const imageHashes = Array.from(
      new Set(newUploads.map((item) => item.imageHash).filter(Boolean)),
    );
    if (imageHashes.length === 0) {
      return true;
    }

    try {
      const duplicateRes = await workService.checkDuplicateImages({
        image_hashes: imageHashes,
      });

      if (duplicateRes.data.code !== 0) {
        toast.error(duplicateRes.data.message || "重复图片检查失败");
        return false;
      }

      const duplicates = duplicateRes.data.data?.duplicates ?? [];
      if (duplicates.length === 0) {
        return true;
      }

      setDuplicateImages(duplicates);
      setDuplicateDialogOpen(true);
      return false;
    } catch (err) {
      console.error("重复图片检查失败", err);
      toast.error("重复图片检查失败");
      return false;
    }
  };

  const uniqueDuplicateWorkIDs = useMemo(() => {
    return Array.from(new Set(duplicateImages.map((item) => item.work_id)));
  }, [duplicateImages]);

  const clearNewUploads = () => {
    setNewUploads((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
  };

  const handleDeleteImage = async (imageId: number) => {
    if (!workId) return;
    try {
      await workService.deleteImage(workId, imageId);
      setWork((prev) =>
        prev
          ? {
              ...prev,
              images: prev.images?.filter((img) => img.id !== imageId),
            }
          : prev,
      );
      setImageOrder((prev) => prev.filter((id) => id !== imageId));
      toast.success("图片已删除");
    } catch (err) {
      console.error("删除图片失败", err);
      toast.error("删除图片失败");
    }
  };

  if (loading) {
    return (
      <AdminLayout
        title="作品编辑"
        breadcrumbs={
          isFromCollection && !isNew
            ? [
                { label: "作品集管理", href: "/collections" },
                { label: collectionNameFromSource, href: collectionWorksHref },
                { label: isNew ? "新建作品" : "作品编辑" },
              ]
            : [
                { label: "作品管理", href: "/" },
                { label: isNew ? "新建作品" : "作品编辑" },
              ]
        }
        onLogout={handleLogout}
      >
        <div className="text-center text-muted-foreground">加载中...</div>
      </AdminLayout>
    );
  }

  if (!isNew && !work) {
    return (
      <AdminLayout
        title="作品编辑"
        breadcrumbs={
          isFromCollection
            ? [
                { label: "作品集管理", href: "/collections" },
                { label: collectionNameFromSource, href: collectionWorksHref },
                { label: "作品编辑" },
              ]
            : [{ label: "作品管理", href: "/" }, { label: "作品编辑" }]
        }
        onLogout={handleLogout}
      >
        <div className="text-center text-muted-foreground">作品不存在</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={isNew ? "新建作品" : "作品编辑"}
      breadcrumbs={
        isNew
          ? [{ label: "作品管理", href: "/" }, { label: "新建作品" }]
          : isFromCollection
            ? [
                { label: "作品集管理", href: "/collections" },
                { label: collectionNameFromSource, href: collectionWorksHref },
                { label: work?.title || "作品编辑" },
              ]
            : [
                { label: "作品管理", href: "/" },
                { label: work?.title || "作品编辑" },
              ]
      }
      onLogout={handleLogout}
    >
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <label
              htmlFor="imageUpload"
              className={`
                flex flex-col items-center justify-center border-2 border-dashed rounded-lg h-52 cursor-pointer transition-colors
                ${
                  isDragging
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-accent/40"
                }
              `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                id="imageUpload"
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <p className="text-sm text-muted-foreground">
                {isDragging ? "释放以添加图片" : uploadHint}
              </p>
              {!isNew && (
                <p className="text-xs text-muted-foreground mt-1">
                  支持 PNG / JPG / GIF / WebP / BMP / TIFF
                </p>
              )}
            </label>
          </div>

          {!isNew && orderedImages.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-foreground mb-3">
                现有图片
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {orderedImages.map((img, index) => (
                  <div
                    key={img.id}
                    className="border border-border rounded-lg overflow-hidden"
                  >
                    <AuthImage
                      path={img.thumbnail_path}
                      alt={work?.title || "图片"}
                      className="w-full aspect-square object-cover"
                    />
                    <div className="flex items-center justify-between px-2 py-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span className="text-foreground font-medium">
                          #{index + 1}
                        </span>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() =>
                            moveImage(index, Math.max(index - 1, 0))
                          }
                          disabled={index === 0}
                        >
                          上移
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() =>
                            moveImage(
                              index,
                              Math.min(index + 1, orderedImages.length - 1),
                            )
                          }
                          disabled={index === orderedImages.length - 1}
                        >
                          下移
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleDeleteImage(img.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {newUploads.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-foreground mb-3">
                {isNew ? "已上传图片" : "待上传图片"}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {newUploads.map((item, index) => (
                  <div
                    key={item.previewUrl}
                    className="border border-border rounded-lg overflow-hidden"
                  >
                    {item.requiresTranscode ? (
                      <div className="w-full aspect-square bg-muted flex flex-col items-center justify-center text-muted-foreground">
                        <span className="text-xs">待转码</span>
                        <span className="text-[11px] mt-1">
                          {item.file.name}
                        </span>
                      </div>
                    ) : (
                      <img
                        src={item.previewUrl}
                        alt={isNew ? `upload-${index}` : `new-${index}`}
                        className="w-full aspect-square object-cover"
                      />
                    )}
                    <div className="flex items-center justify-between px-2 py-2 text-xs text-muted-foreground">
                      {isNew ? (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() =>
                              moveNewUpload(index, Math.max(index - 1, 0))
                            }
                            disabled={index === 0}
                          >
                            上移
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() =>
                              moveNewUpload(
                                index,
                                Math.min(index + 1, newUploads.length - 1),
                              )
                            }
                            disabled={index === newUploads.length - 1}
                          >
                            下移
                          </Button>
                        </div>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => removeNewUpload(index)}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                标题
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="请输入作品标题"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                描述
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder="可选，支持 Markdown"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                评分
              </label>
              <div className="flex gap-2">
                {[0, 1, 2, 3, 4, 5].map((value) => (
                  <Button
                    key={value}
                    variant={value === rating ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRating(value)}
                  >
                    {value}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                标签
              </label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);
                  return (
                    <Button
                      key={tag.id}
                      variant={selected ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSelectedTagIds((prev) =>
                          selected
                            ? prev.filter((id) => id !== tag.id)
                            : [...prev, tag.id],
                        );
                      }}
                    >
                      {tag.name}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="publicSwitch"
                checked={isPublic}
                onCheckedChange={(checked) => setIsPublic(checked === true)}
              />
              <label htmlFor="publicSwitch" className="text-sm text-foreground">
                公开展示
              </label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 rounded-full text-muted-foreground"
                      aria-label="公开展示说明"
                    >
                      <CircleHelp className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>
                    勾选后可通过公开接口访问该作品图片，便于外部页面嵌入展示。
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleSave}
                disabled={!canSave}
                className="flex-1"
              >
                {saving ? "保存中..." : "保存"}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  navigate(
                    isFromCollection && !isNew ? collectionWorksHref : "/",
                  )
                }
                className="flex-1"
              >
                {isNew ? "取消" : "返回"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>检测到重复图片</AlertDialogTitle>
            <AlertDialogDescription>
              新增图片中有 {duplicateImages.length} 张与已存在图片哈希一致。
              {uniqueDuplicateWorkIDs.length > 0
                ? `重复图片所在作品 ID：${uniqueDuplicateWorkIDs.join(", ")}`
                : ""}
              。您仍可继续保存。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回检查</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDuplicateDialogOpen(false);
                setDuplicateImages([]);
                void executeSave();
              }}
            >
              继续保存
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}

async function performDigest(buffer: ArrayBuffer): Promise<string> {
  const digest = await window.crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function computeImageHash(file: File): Promise<string> {
  if (!window.crypto?.subtle) {
    throw new Error("Web Crypto API is not available");
  }
  const buffer = await file.arrayBuffer();
  return performDigest(buffer);
}

function shouldShowTranscodePlaceholder(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = file.type.toLowerCase();
  return (
    mime === "image/tiff" ||
    mime === "image/bmp" ||
    mime === "image/x-ms-bmp" ||
    ext === "tif" ||
    ext === "tiff" ||
    ext === "bmp" ||
    ext === "dib"
  );
}
