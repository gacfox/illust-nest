import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
        console.error("加载作品失败", err);
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
      .catch((err) => console.error("加载标签失败", err));
  }, []);

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
      console.error("批量删除失败", err);
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
      console.error("批量更新公开状态失败", err);
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
      console.error("删除失败", err);
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
      title="作品管理"
      breadcrumbs={[{ label: "作品管理" }]}
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
                placeholder="搜索标题或描述"
                className="pr-9"
              />
              {keyword && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setKeyword("")}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  aria-label="清除输入"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-1" />
              搜索
            </Button>
            <Button
              variant="outline"
              onClick={() => setFilterOpen((prev) => !prev)}
              className="inline-flex items-center gap-2"
            >
              <SlidersHorizontal className="h-4 w-4" />
              筛选
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
              批量
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => navigate("/works/create")}>
              <Plus className="h-4 w-4" />
              新建
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
                <span className="text-sm text-muted-foreground">评分</span>
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
                <span className="text-sm text-muted-foreground">至</span>
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
                <span className="text-sm text-muted-foreground">公开状态</span>
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
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="public">公开</SelectItem>
                    <SelectItem value="private">私密</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">排序</span>
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
                      创建时间 <ArrowDown className="inline h-3 w-3" />
                    </SelectItem>
                    <SelectItem value="created_at:asc">
                      创建时间 <ArrowUp className="inline h-3 w-3" />
                    </SelectItem>
                    <SelectItem value="updated_at:desc">
                      更新时间 <ArrowDown className="inline h-3 w-3" />
                    </SelectItem>
                    <SelectItem value="updated_at:asc">
                      更新时间 <ArrowUp className="inline h-3 w-3" />
                    </SelectItem>
                    <SelectItem value="rating:desc">
                      评分 <ArrowDown className="inline h-3 w-3" />
                    </SelectItem>
                    <SelectItem value="rating:asc">
                      评分 <ArrowUp className="inline h-3 w-3" />
                    </SelectItem>
                    <SelectItem value="title:asc">
                      标题 <ArrowUp className="inline h-3 w-3" />
                    </SelectItem>
                    <SelectItem value="title:desc">
                      标题 <ArrowDown className="inline h-3 w-3" />
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={handleSearch}>
                应用筛选
              </Button>
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                重置
              </Button>
            </div>
          </div>
        )}

        {batchPanelOpen && (
          <div className="bg-card border border-border rounded-lg p-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              已选 {selectedIds.length} 项
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds(works.map((item) => item.id))}
              disabled={works.length === 0}
            >
              全选当前页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds([])}
              disabled={selectedIds.length === 0}
            >
              清空选择
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBatchDeleteOpen(true)}
              disabled={selectedIds.length === 0}
            >
              批量删除
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBatchPublic(true)}
              disabled={selectedIds.length === 0}
            >
              设为公开
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBatchPublic(false)}
              disabled={selectedIds.length === 0}
            >
              设为私密
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setBatchPanelOpen(false);
                setSelectedIds([]);
              }}
            >
              收起
            </Button>
          </div>
        )}
      </div>

      <div className="h-4" />
      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">加载中...</p>
        </div>
      ) : works.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">暂无作品</p>
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
                      aria-label="编辑作品"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => setDeleteWorkId(work.id)}
                      className="h-7 w-7"
                      aria-label="删除作品"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                }
              />
            ))}
          </div>
          <div ref={loadMoreRef} className="py-4 text-center">
            {loadingMore && <p className="text-muted-foreground">加载中...</p>}
            {!hasMore && works.length > 0 && (
              <p className="text-muted-foreground text-sm">没有更多了</p>
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
            <AlertDialogTitle>确认批量删除作品？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除选中的 {selectedIds.length} 个作品，该操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingBatch}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleBatchDelete}
              disabled={deletingBatch || selectedIds.length === 0}
            >
              {deletingBatch ? "删除中..." : "确认删除"}
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
            <AlertDialogTitle>确认删除作品？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后将无法恢复该作品及其关联图片。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSingle}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deletingSingle}
            >
              {deletingSingle ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
