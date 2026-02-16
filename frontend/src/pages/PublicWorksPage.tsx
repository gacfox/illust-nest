import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, Search, SlidersHorizontal, X } from "lucide-react";

import { PublicLayout } from "@/components/PublicLayout";
import { WorkCard } from "@/components/WorkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tagService, workService } from "@/services";
import { useSystemStatus } from "@/hooks/useSystemStatus";
import type { Tag, Work } from "@/types/api";

export function PublicWorksPage() {
  const navigate = useNavigate();
  const { status } = useSystemStatus();
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
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const mergeTagsFromWorks = useCallback((items: Work[]) => {
    if (items.length === 0) return;
    setTags((prev) => {
      const byID = new Map<number, Tag>();
      for (const tag of prev) {
        byID.set(tag.id, tag);
      }
      for (const work of items) {
        for (const tag of work.tags ?? []) {
          if (!byID.has(tag.id)) {
            byID.set(tag.id, tag);
          }
        }
      }
      return Array.from(byID.values());
    });
  }, []);

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
          sort_by: sortBy,
          sort_order: sortOrder,
        };
        const res = await workService.listPublic(params);
        if (res.data.code === 0) {
          const items = res.data.data?.items ?? [];
          mergeTagsFromWorks(items);
          if (append) {
            setWorks((prev) => [...prev, ...items]);
          } else {
            setWorks(items);
          }
          setHasMore(items.length === 20);
          setPage(pageNum);
        }
      } catch (err) {
        console.error("加载公开作品失败", err);
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
      sortBy,
      sortOrder,
      mergeTagsFromWorks,
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
      observerRef.current?.disconnect();
    };
  }, [hasMore, loadingMore, loading, page, loadWorks]);

  useEffect(() => {
    tagService
      .listPublic()
      .then((res) => {
        if (res.data.code === 0) {
          const data = res.data.data as Tag[] | { items?: Tag[] };
          const list = Array.isArray(data) ? data : (data.items ?? []);
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
    setSortBy("created_at");
    setSortOrder("desc");
    loadWorks(1, false);
  };

  const filteredTagCount = useMemo(
    () => selectedTagIds.length,
    [selectedTagIds],
  );

  return (
    <PublicLayout
      title="公开作品"
      siteTitle={status?.site_title || "Illust Nest"}
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

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">加载中...</p>
          </div>
        ) : works.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">暂无公开作品</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-6 gap-5">
              {works.map((work) => (
                <WorkCard
                  key={work.id}
                  work={work}
                  showPublicBadge
                  publicAccess
                  onPreview={() => navigate(`/public/works/${work.id}/preview`)}
                />
              ))}
            </div>
            <div ref={loadMoreRef} className="py-4 text-center">
              {loadingMore && (
                <p className="text-muted-foreground">加载中...</p>
              )}
              {!hasMore && works.length > 0 && (
                <p className="text-muted-foreground text-sm">没有更多了</p>
              )}
            </div>
          </>
        )}
      </div>
    </PublicLayout>
  );
}
