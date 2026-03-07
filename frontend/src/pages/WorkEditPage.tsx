import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CircleHelp, Sparkles, Plus, Trash2 } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { tagService, workService } from "@/services";
import type {
  AIImageMetadata,
  AIImageMetadataKeyValue,
  DuplicateImageInfo,
  Image,
  Tag,
  Work,
} from "@/types/api";
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
  aiMetadata?: AIImageMetadata;
};

type EditableAIMetadataItem = {
  key: string;
  value1: string;
  value2: string;
};

type EditingAIMetadataTarget =
  | {
      kind: "new";
      index: number;
    }
  | {
      kind: "existing";
      imageId: number;
    };

export function WorkEditPage() {
  const { t } = useTranslation();
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
  const [aiMetadataDialogOpen, setAIMetadataDialogOpen] = useState(false);
  const [editingAIMetadataTarget, setEditingAIMetadataTarget] =
    useState<EditingAIMetadataTarget | null>(null);
  const [aiMetadataEnabled, setAIMetadataEnabled] = useState(false);
  const [aiCheckpoint, setAICheckpoint] = useState("");
  const [aiPrompt, setAIPrompt] = useState("");
  const [aiNegativePrompt, setAINegativePrompt] = useState("");
  const [aiOtherMetadata, setAIOtherMetadata] = useState<
    EditableAIMetadataItem[]
  >([]);
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
      : t("collections.title").replace("管理", "");
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
      console.error(t("works.loadFailed"), err);
      setError(t("works.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [workId, navigate, t, isNew]);

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
        isSupportedUploadFile(file),
      );
      if (imageFiles.length === 0) {
        toast.error(t("works.fields.dropToUpload"));
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
      return isNew
        ? t("works.fields.uploadHint")
        : t("works.fields.uploadHintEdit");
    return t("works.fields.uploadHintMore");
  }, [newUploads.length, isNew, t]);

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
          formData.append(
            "image_ai_metadata",
            item.aiMetadata ? JSON.stringify(item.aiMetadata) : "",
          );
        });
        const createRes = await workService.create(formData);
        if (createRes.data.code !== 0) {
          toast.error(createRes.data.message || t("works.createFailed"));
          return;
        }
        const createdId = createRes.data.data?.id;
        if (createdId) {
          clearNewUploads();
          toast.success(t("works.createSuccess"));
          navigate(`/works/${createdId}`);
        } else {
          toast.success(t("works.createSuccess"));
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
          toast.error(updateRes.data.message || t("works.saveFailed"));
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
            formData.append(
              "image_ai_metadata",
              item.aiMetadata ? JSON.stringify(item.aiMetadata) : "",
            );
          });
          const uploadRes = await workService.addImages(workId, formData);
          if (uploadRes.data.code !== 0) {
            toast.error(uploadRes.data.message || t("works.uploadFailed"));
            return;
          }
        }

        toast.success(t("works.saveSuccess"));

        clearNewUploads();
        await loadData();
      }
    } catch (err) {
      console.error(t("works.saveFailed"), err);
      const backendMessage =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response
          ?.data?.message === "string"
          ? (err as { response?: { data?: { message?: string } } }).response!
              .data!.message!
          : "";
      toast.error(backendMessage || t("works.saveFailed"));
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
      console.error(t("works.uploadFailed"), err);
      toast.error(t("works.uploadFailed"));
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
        toast.error(duplicateRes.data.message || t("works.uploadFailed"));
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
      console.error(t("works.uploadFailed"), err);
      toast.error(t("works.uploadFailed"));
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

  const openAIMetadataDialogForNewUpload = (index: number) => {
    const target = newUploads[index];
    if (!target) {
      return;
    }
    setEditingAIMetadataTarget({ kind: "new", index });
    const metadata = target.aiMetadata;
    fillAIMetadataForm(metadata);
    setAIMetadataDialogOpen(true);
  };

  const openAIMetadataDialogForExistingImage = (
    imageId: number,
    metadata?: AIImageMetadata,
  ) => {
    setEditingAIMetadataTarget({ kind: "existing", imageId });
    fillAIMetadataForm(metadata);
    setAIMetadataDialogOpen(true);
  };

  const fillAIMetadataForm = (metadata?: AIImageMetadata) => {
    if (!metadata) {
      setAIMetadataEnabled(false);
      setAICheckpoint("");
      setAIPrompt("");
      setAINegativePrompt("");
      setAIOtherMetadata([]);
    } else {
      setAIMetadataEnabled(true);
      setAICheckpoint(metadata.checkpoint ?? "");
      setAIPrompt(metadata.prompt ?? "");
      setAINegativePrompt(metadata.negative_prompt ?? "");
      setAIOtherMetadata(
        (metadata.other_metadata ?? []).map((item) => ({
          key: item.key,
          value1: item.values?.[0] ?? "",
          value2: item.values?.[1] ?? "",
        })),
      );
    }
  };

  const addAIItem = () => {
    setAIOtherMetadata((prev) => [
      ...prev,
      { key: "", value1: "", value2: "" },
    ]);
  };

  const updateAIItem = (
    index: number,
    field: keyof EditableAIMetadataItem,
    value: string,
  ) => {
    setAIOtherMetadata((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
  };

  const removeAIItem = (index: number) => {
    setAIOtherMetadata((prev) => prev.filter((_, idx) => idx !== index));
  };

  const saveAIMetadata = async () => {
    if (editingAIMetadataTarget === null) {
      return;
    }
    if (aiMetadataEnabled) {
      if (!aiCheckpoint.trim() || !aiPrompt.trim()) {
        toast.error(t("aiMetadata.checkpointAndPromptRequired"));
        return;
      }
    }

    const normalizedOtherMetadata: AIImageMetadataKeyValue[] = aiOtherMetadata
      .map((item) => {
        const key = item.key.trim();
        if (!key) {
          return null;
        }
        const values = [item.value1.trim(), item.value2.trim()].filter(
          (v) => v.length > 0,
        );
        return {
          key,
          values,
        };
      })
      .filter((item): item is AIImageMetadataKeyValue => item !== null);

    const metadata = aiMetadataEnabled
      ? {
          checkpoint: aiCheckpoint.trim(),
          prompt: aiPrompt.trim(),
          negative_prompt: aiNegativePrompt.trim(),
          other_metadata: normalizedOtherMetadata,
        }
      : undefined;

    if (editingAIMetadataTarget.kind === "new") {
      const targetIndex = editingAIMetadataTarget.index;
      setNewUploads((prev) =>
        prev.map((item, idx) =>
          idx === targetIndex
            ? {
                ...item,
                aiMetadata: metadata,
              }
            : item,
        ),
      );
      setAIMetadataDialogOpen(false);
      toast.success(t("aiMetadata.updateSuccess"));
      return;
    }

    if (!workId) {
      toast.error(t("aiMetadata.invalidWorkId"));
      return;
    }

    try {
      const imageId = editingAIMetadataTarget.imageId;
      const res = await workService.updateImageAIMetadata(
        workId,
        imageId,
        metadata ?? null,
      );
      if (res.data.code !== 0) {
        toast.error(res.data.message || t("aiMetadata.updateFailed"));
        return;
      }
      setWork((prev) =>
        prev
          ? {
              ...prev,
              images: prev.images?.map((img) =>
                img.id === imageId
                  ? {
                      ...img,
                      ai_metadata: metadata,
                    }
                  : img,
              ),
            }
          : prev,
      );
      setAIMetadataDialogOpen(false);
      toast.success(t("aiMetadata.updateSuccess"));
    } catch (err) {
      console.error(t("aiMetadata.updateFailed"), err);
      toast.error(t("aiMetadata.updateFailed"));
    }
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
      toast.success(t("works.deleteSuccess"));
    } catch (err) {
      console.error(t("works.deleteFailed"), err);
      toast.error(t("works.deleteFailed"));
    }
  };

  if (loading) {
    return (
      <AdminLayout
        title={t("works.editWork")}
        breadcrumbs={
          isFromCollection && !isNew
            ? [
                { label: t("collections.title"), href: "/collections" },
                { label: collectionNameFromSource, href: collectionWorksHref },
                { label: isNew ? t("works.newWork") : t("works.editWork") },
              ]
            : [
                { label: t("works.title"), href: "/" },
                { label: isNew ? t("works.newWork") : t("works.editWork") },
              ]
        }
        onLogout={handleLogout}
      >
        <div className="text-center text-muted-foreground">
          {t("app.loading")}
        </div>
      </AdminLayout>
    );
  }

  if (!isNew && !work) {
    return (
      <AdminLayout
        title={t("works.editWork")}
        breadcrumbs={
          isFromCollection
            ? [
                { label: t("collections.title"), href: "/collections" },
                { label: collectionNameFromSource, href: collectionWorksHref },
                { label: t("works.editWork") },
              ]
            : [
                { label: t("works.title"), href: "/" },
                { label: t("works.editWork") },
              ]
        }
        onLogout={handleLogout}
      >
        <div className="text-center text-muted-foreground">
          {t("works.workNotFound")}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={isNew ? t("works.newWork") : t("works.editWork")}
      breadcrumbs={
        isNew
          ? [
              { label: t("works.title"), href: "/" },
              { label: t("works.newWork") },
            ]
          : isFromCollection
            ? [
                { label: t("collections.title"), href: "/collections" },
                { label: collectionNameFromSource, href: collectionWorksHref },
                { label: work?.title || t("works.editWork") },
              ]
            : [
                { label: t("works.title"), href: "/" },
                { label: work?.title || t("works.editWork") },
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
                accept="image/*,.psd,.ai,.heic,.heif,.avif"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <p className="text-sm text-muted-foreground">
                {isDragging ? t("works.fields.dropToUpload") : uploadHint}
              </p>
              {!isNew && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t("works.fields.supportedFormats")}
                </p>
              )}
            </label>
          </div>

          {!isNew && orderedImages.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-foreground mb-3">
                {t("works.fields.existingImages")}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {orderedImages.map((img, index) => (
                  <div
                    key={img.id}
                    className="border border-border rounded-lg overflow-hidden"
                  >
                    <AuthImage
                      path={img.thumbnail_path}
                      alt={work?.title || t("common.noImage")}
                      className="w-full aspect-square object-cover"
                    />
                    <div className="flex items-center justify-between px-2 py-2 text-xs text-muted-foreground">
                      <div className="flex flex-wrap items-center gap-2">
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
                          {t("works.fields.moveUp")}
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
                          {t("works.fields.moveDown")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() =>
                            openAIMetadataDialogForExistingImage(
                              img.id,
                              img.ai_metadata,
                            )
                          }
                        >
                          <Sparkles className="h-3.5 w-3.5 mr-1" />
                          AI
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleDeleteImage(img.id)}
                      >
                        {t("common.delete")}
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
                {t("works.fields.pendingImages")}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {newUploads.map((item, index) => (
                  <div
                    key={item.previewUrl}
                    className="border border-border rounded-lg overflow-hidden"
                  >
                    {item.requiresTranscode ? (
                      <div className="w-full aspect-square bg-muted flex flex-col items-center justify-center text-muted-foreground">
                        <span className="text-xs">
                          {t("works.fields.transcodePending")}
                        </span>
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
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() =>
                              moveNewUpload(index, Math.max(index - 1, 0))
                            }
                            disabled={index === 0}
                          >
                            {t("works.fields.moveUp")}
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
                            {t("works.fields.moveDown")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() =>
                              openAIMetadataDialogForNewUpload(index)
                            }
                          >
                            <Sparkles className="h-3.5 w-3.5 mr-1" />
                            AI
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() =>
                            openAIMetadataDialogForNewUpload(index)
                          }
                        >
                          <Sparkles className="h-3.5 w-3.5 mr-1" />
                          AI
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => removeNewUpload(index)}
                      >
                        {t("common.delete")}
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
                {t("works.fields.title")}
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("works.fields.titlePlaceholder")}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t("works.fields.description")}
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder={t("works.fields.descriptionPlaceholder")}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t("works.fields.rating")}
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
                {t("works.fields.tags")}
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
                {t("works.fields.publicDisplay")}
              </label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 rounded-full text-muted-foreground"
                      aria-label={t("ariaLabels.publicDisplayHelp")}
                    >
                      <CircleHelp className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>
                    {t("works.fields.publicDisplayHelp")}
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
                {saving ? t("common.saving") : t("common.save")}
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
                {isNew ? t("common.cancel") : t("common.back")}
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
            <AlertDialogTitle>{t("duplicateImages.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("duplicateImages.description", {
                count: duplicateImages.length,
                workIds: uniqueDuplicateWorkIDs.join(", "),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("duplicateImages.backToCheck")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDuplicateDialogOpen(false);
                setDuplicateImages([]);
                void executeSave();
              }}
            >
              {t("duplicateImages.continueSave")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={aiMetadataDialogOpen}
        onOpenChange={(open) => {
          setAIMetadataDialogOpen(open);
          if (!open) {
            setEditingAIMetadataTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("aiMetadata.editTitle")}</DialogTitle>
            <DialogDescription>
              {t("aiMetadata.editDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="aiMetadataEnabled"
                checked={aiMetadataEnabled}
                onCheckedChange={(checked) =>
                  setAIMetadataEnabled(checked === true)
                }
              />
              <label
                htmlFor="aiMetadataEnabled"
                className="text-sm text-foreground"
              >
                {t("aiMetadata.enabled")}
              </label>
            </div>

            {aiMetadataEnabled && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t("aiMetadata.checkpoint")}
                  </label>
                  <Input
                    value={aiCheckpoint}
                    onChange={(e) => setAICheckpoint(e.target.value)}
                    placeholder={t("aiMetadata.checkpointPlaceholder")}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t("aiMetadata.prompt")}
                  </label>
                  <Textarea
                    value={aiPrompt}
                    onChange={(e) => setAIPrompt(e.target.value)}
                    rows={4}
                    placeholder={t("aiMetadata.promptPlaceholder")}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t("aiMetadata.negativePrompt")}
                  </label>
                  <Textarea
                    value={aiNegativePrompt}
                    onChange={(e) => setAINegativePrompt(e.target.value)}
                    rows={3}
                    placeholder={t("aiMetadata.negativePromptPlaceholder")}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">
                      {t("aiMetadata.otherMetadata")}
                    </label>
                    <Button variant="outline" size="sm" onClick={addAIItem}>
                      <Plus className="h-4 w-4 mr-1" />
                      {t("aiMetadata.addField")}
                    </Button>
                  </div>
                  {aiOtherMetadata.length === 0 ? (
                    <div className="text-xs text-muted-foreground">
                      {t("aiMetadata.noCustomFields")}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {aiOtherMetadata.map((item, index) => (
                        <div
                          key={`other-meta-${index}`}
                          className="grid grid-cols-12 gap-2 items-center"
                        >
                          <Input
                            className="col-span-3"
                            placeholder={t("aiMetadata.keyPlaceholder")}
                            value={item.key}
                            onChange={(e) =>
                              updateAIItem(index, "key", e.target.value)
                            }
                          />
                          <Input
                            className="col-span-4"
                            placeholder={t("aiMetadata.value1Placeholder")}
                            value={item.value1}
                            onChange={(e) =>
                              updateAIItem(index, "value1", e.target.value)
                            }
                          />
                          <Input
                            className="col-span-4"
                            placeholder={t("aiMetadata.value2Placeholder")}
                            value={item.value2}
                            onChange={(e) =>
                              updateAIItem(index, "value2", e.target.value)
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="col-span-1"
                            onClick={() => removeAIItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAIMetadataDialogOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={saveAIMetadata}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    mime === "image/psd" ||
    mime === "image/x-psd" ||
    mime === "image/photoshop" ||
    mime === "image/x-photoshop" ||
    mime === "application/photoshop" ||
    mime === "application/x-photoshop" ||
    mime === "application/psd" ||
    mime === "application/postscript" ||
    mime === "application/illustrator" ||
    mime === "image/heic" ||
    mime === "image/heif" ||
    mime === "image/avif" ||
    ext === "tif" ||
    ext === "tiff" ||
    ext === "bmp" ||
    ext === "dib" ||
    ext === "psd" ||
    ext === "ai" ||
    ext === "heic" ||
    ext === "heif" ||
    ext === "avif"
  );
}

function isSupportedUploadFile(file: File): boolean {
  const mime = file.type.toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (mime.startsWith("image/")) {
    return true;
  }
  return (
    ext === "psd" ||
    ext === "ai" ||
    ext === "heic" ||
    ext === "heif" ||
    ext === "avif" ||
    mime === "application/photoshop" ||
    mime === "application/x-photoshop" ||
    mime === "application/psd" ||
    mime === "application/postscript" ||
    mime === "application/illustrator"
  );
}
