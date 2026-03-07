import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { tagService, workService } from "@/services";
import { useNavigate } from "react-router-dom";
import type { Tag, Work } from "@/types/api";
import { AdminLayout } from "@/components/AdminLayout";
import { WorkCard } from "@/components/WorkCard";
import { useAuthStore } from "@/stores";
import {
  Plus,
  ListChecks,
  SlidersHorizontal,
  X,
  ArrowDown,
  ArrowUp,
  Search,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [tags, setTags] = useState<Tag[]>([]);
  const [keyword, setKeyword] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [ratingMin, setRatingMin] = useState(0);
  const [ratingMax, setRatingMax] = useState(5);
  const [isPublic, setIsPublic] = useState<"all" | "public" | "private">("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [batchPanelOpen, setBatchPanelOpen] = useState(false);
  const [deleteWorkId, setDeleteWorkId] = useState<number | null>(null);
  const [deletingSingle, setDeletingSingle] = useState(false);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [deletingBatch, setDeletingBatch] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const loadWorks = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      try {
        const params = {
          page: pageNum,
          page_size: 20,
          keyword: keyword.trim() || undefined,
          tag_ids:
            selectedTagIds.length > 0 ? selectedTagIds.join(",") : undefined,
          rating_min: ratingMin,
          rating_max: ratingMax,
          is_public: isPublic === "all" ? undefined : isPublic === "public",
          sort_by: sortBy,
          sort_order: sortOrder,
        };
        const res = await workService.list(params);
        if (res.data.code === 0) {
          const items = res.data.data?.items ?? [];
          if (append) {
            setWorks((prev) => [...prev, ...items]);
          } else {
            setWorks(items);
          }
          setHasMore(items.length === 20);
          setPage(pageNum);
        }
      } catch (err) {
        console.error(t("works.loadFailed"), err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      keyword,
      selectedTagIds,
      ratingMin,
      ratingMax,
      isPublic,
      sortBy,
      sortOrder,
      t,
    ],
  );

  useEffect(() => {
    loadWorks();
  }, []);

  useEffect(() => {
    const handleObserver: IntersectionObserverCallback = (entries) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !loadingMore && !loading) {
        loadWorks(page + 1, true);
      }
    };

    observerRef.current = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "100px",
      threshold: 0,
    });

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loadingMore, loading, page, loadWorks]);

  useEffect(() => {
    loadWorks(1, false);
  }, []);

  useEffect(() => {
    tagService
      .list()
      .then((res) => {
        if (res.data.code === 0) {
          const data = res.data.data as any;
          const list = Array.isArray(data) ? data : (data?.items ?? []);
          setTags(list);
        }
      })
      .catch((err) => console.error(t("tags.loadFailed"), err));
  }, [t]);

  const handleSearch = () => {
    loadWorks(1, false);
  };

  const handleResetFilters = () => {
    setKeyword("");
    setSelectedTagIds([]);
    setRatingMin(0);
    setRatingMax(5);
    setIsPublic("all");
    setSortBy("created_at");
    setSortOrder("desc");
    setLoading(true);
    loadWorks(1, false);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    setDeletingBatch(true);
    try {
      await workService.batchDelete(selectedIds);
      setSelectedIds([]);
      setBatchDeleteOpen(false);
      loadWorks();
    } catch (err) {
      console.error(t("works.deleteFailed"), err);
    } finally {
      setDeletingBatch(false);
    }
  };

  const handleBatchPublic = async (value: boolean) => {
    if (selectedIds.length === 0) return;
    try {
      await workService.batchUpdatePublic(selectedIds, value);
      setSelectedIds([]);
      loadWorks();
    } catch (err) {
      console.error(t("works.saveFailed"), err);
    }
  };

  const handleDelete = async () => {
    if (!deleteWorkId) return;
    setDeletingSingle(true);
    try {
      await workService.delete(deleteWorkId);
      setDeleteWorkId(null);
      loadWorks();
    } catch (err) {
      console.error(t("works.deleteFailed"), err);
    } finally {
      setDeletingSingle(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    localStorage.removeItem("token");
    navigate("/login");
  };

  const filteredTagCount = useMemo(
    () => selectedTagIds.length,
    [selectedTagIds],
  );

  return (
    <AdminLayout
      title={t("works.title")}
      breadcrumbs={[{ label: t("works.title") }]}
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
                placeholder={t("works.searchPlaceholder")}
                className="pr-9"
              />
              {keyword && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setKeyword("")}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  aria-label={t("ariaLabels.clearInput")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-1" />
              {t("common.search")}
            </Button>
            <Button
              variant="outline"
              onClick={() => setFilterOpen((prev) => !prev)}
              className="inline-flex items-center gap-2"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {t("works.filter")}
              {filteredTagCount > 0 && (
                <span className="text-xs bg-primary text-primary-foreground rounded-full px-2">
                  {filteredTagCount}
                </span>
              )}
            </Button>
            <Button
              variant={batchPanelOpen ? "default" : "outline"}
              onClick={() => {
                const next = !batchPanelOpen;
                setBatchPanelOpen(next);
                if (!next) {
                  setSelectedIds([]);
                }
              }}
              className="inline-flex items-center gap-2"
            >
              <ListChecks className="h-4 w-4" />
              {t("works.batch")}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => navigate("/works/create")}>
              <Plus className="h-4 w-4" />
              {t("works.create")}
            </Button>
          </div>
        </div>

        {filterOpen && (
          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
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
                    className="rounded-full text-xs"
                  >
                    {tag.name}
                  </Button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {t("rating.label")}
                </span>
                <Select
                  value={ratingMin.toString()}
                  onValueChange={(value) => setRatingMin(Number(value))}
                >
                  <SelectTrigger size="sm" className="w-17.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4, 5].map((v) => (
                      <SelectItem key={`min-${v}`} value={v.toString()}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">
                  {t("rating.range")}
                </span>
                <Select
                  value={ratingMax.toString()}
                  onValueChange={(value) => setRatingMax(Number(value))}
                >
                  <SelectTrigger size="sm" className="w-17.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4, 5].map((v) => (
                      <SelectItem key={`max-${v}`} value={v.toString()}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {t("publicStatus.label")}
                </span>
                <Select
                  value={isPublic}
                  onValueChange={(value) =>
                    setIsPublic(value as "all" | "public" | "private")
                  }
                >
                  <SelectTrigger size="sm" className="w-25">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("publicStatus.all")}</SelectItem>
                    <SelectItem value="public">
                      {t("publicStatus.public")}
                    </SelectItem>
                    <SelectItem value="private">
                      {t("publicStatus.private")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {t("sort.label")}
                </span>
                <Select
                  value={`${sortBy}:${sortOrder}`}
                  onValueChange={(value) => {
                    const [by, order] = value.split(":");
                    setSortBy(by);
                    setSortOrder(order);
                  }}
                >
                  <SelectTrigger size="sm" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at:desc">
                      {t("works.sortOptions.createdAtDesc")}{" "}
                      <ArrowDown className="inline h-3 w-3" />
                    </SelectItem>
                    <SelectItem value="created_at:asc">
                      {t("works.sortOptions.createdAtAsc")}{" "}
                      <ArrowUp className="inline h-3 w-3" />
                    </SelectItem>
                    <SelectItem value="updated_at:desc">
                      {t("works.sortOptions.updatedAtDesc")}{" "}
                      <ArrowDown className="inline h-3 w-3" />
                    </SelectItem>
                    <SelectItem value="updated_at:asc">
                      {t("works.sortOptions.updatedAtAsc")}{" "}
                      <ArrowUp className="inline h-3 w-3" />
                    </SelectItem>
                    <SelectItem value="rating:desc">
                      {t("works.sortOptions.ratingDesc")}{" "}
                      <ArrowDown className="inline h-3 w-3" />
                    </SelectItem>
                    <SelectItem value="rating:asc">
                      {t("works.sortOptions.ratingAsc")}{" "}
                      <ArrowUp className="inline h-3 w-3" />
                    </SelectItem>
                    <SelectItem value="title:asc">
                      {t("works.sortOptions.titleAsc")}{" "}
                      <ArrowUp className="inline h-3 w-3" />
                    </SelectItem>
                    <SelectItem value="title:desc">
                      {t("works.sortOptions.titleDesc")}{" "}
                      <ArrowDown className="inline h-3 w-3" />
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={handleSearch}>
                {t("common.apply")}
              </Button>
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                {t("common.reset")}
              </Button>
            </div>
          </div>
        )}

        {batchPanelOpen && (
          <div className="bg-card border border-border rounded-lg p-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {t("common.selected", { count: selectedIds.length })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds(works.map((item) => item.id))}
              disabled={works.length === 0}
            >
              {t("common.selectAll")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds([])}
              disabled={selectedIds.length === 0}
            >
              {t("common.clearSelection")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBatchDeleteOpen(true)}
              disabled={selectedIds.length === 0}
            >
              {t("works.batchDelete")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBatchPublic(true)}
              disabled={selectedIds.length === 0}
            >
              {t("works.setPublic")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBatchPublic(false)}
              disabled={selectedIds.length === 0}
            >
              {t("works.setPrivate")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setBatchPanelOpen(false);
                setSelectedIds([]);
              }}
            >
              {t("common.close")}
            </Button>
          </div>
        )}
      </div>

      <div className="h-4" />
      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t("app.loading")}</p>
        </div>
      ) : works.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t("works.noWorks")}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-6 gap-5">
            {works.map((work) => (
              <WorkCard
                key={work.id}
                work={work}
                showPublicBadge
                onPreview={() => navigate(`/works/${work.id}/preview`)}
                topLeftOverlay={
                  batchPanelOpen ? (
                    <Checkbox
                      checked={selectedIds.includes(work.id)}
                      onCheckedChange={() => toggleSelect(work.id)}
                      className="bg-background border-border"
                    />
                  ) : undefined
                }
                bottomLeftOverlay={
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => navigate(`/works/${work.id}`)}
                      className="h-7 w-7"
                      aria-label={t("ariaLabels.editWork")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => setDeleteWorkId(work.id)}
                      className="h-7 w-7"
                      aria-label={t("ariaLabels.deleteWork")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                }
              />
            ))}
          </div>
          <div ref={loadMoreRef} className="py-4 text-center">
            {loadingMore && (
              <p className="text-muted-foreground">{t("app.loading")}</p>
            )}
            {!hasMore && works.length > 0 && (
              <p className="text-muted-foreground text-sm">{t("app.noMore")}</p>
            )}
          </div>
        </>
      )}

      <AlertDialog
        open={batchDeleteOpen}
        onOpenChange={(open) => {
          if (!deletingBatch) {
            setBatchDeleteOpen(open);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("works.confirmBatchDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("works.batchDeleteDescription", { count: selectedIds.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingBatch}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleBatchDelete}
              disabled={deletingBatch || selectedIds.length === 0}
            >
              {deletingBatch ? t("common.deleting") : t("common.confirmDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteWorkId !== null}
        onOpenChange={(open) => {
          if (!open && !deletingSingle) {
            setDeleteWorkId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("works.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("works.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSingle}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deletingSingle}
            >
              {deletingSingle
                ? t("common.deleting")
                : t("common.confirmDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
