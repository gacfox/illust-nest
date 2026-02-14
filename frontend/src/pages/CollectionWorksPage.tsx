import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { AdminLayout } from "@/components/AdminLayout";
import { WorkCard } from "@/components/WorkCard";
import { Button } from "@/components/ui/button";
import { collectionService } from "@/services";
import { useAuthStore } from "@/stores";
import type { Work } from "@/types/api";

export function CollectionWorksPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const collectionId = Number(id);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const [collectionName, setCollectionName] = React.useState("作品集");
  const [works, setWorks] = React.useState<Work[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const loadMoreRef = React.useRef<HTMLDivElement>(null);
  const observerRef = React.useRef<IntersectionObserver | null>(null);

  const handleLogout = () => {
    clearAuth();
    localStorage.removeItem("token");
    navigate("/login");
  };

  const loadCollection = React.useCallback(async () => {
    if (!Number.isFinite(collectionId) || collectionId <= 0) {
      navigate("/collections");
      return;
    }
    try {
      const res = await collectionService.get(collectionId);
      if (res.data.code === 0 && res.data.data?.name) {
        setCollectionName(res.data.data.name);
      }
    } catch (error) {
      console.error("加载作品集信息失败", error);
    }
  }, [collectionId, navigate]);

  const loadWorks = React.useCallback(
    async (pageNum: number, append: boolean) => {
      if (!Number.isFinite(collectionId) || collectionId <= 0) {
        return;
      }

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const res = await collectionService.getWorks(collectionId, {
          page: pageNum,
          page_size: 20,
          sort_by: "created_at",
          sort_order: "desc",
        });
        if (res.data.code !== 0) {
          if (!append) {
            setWorks([]);
          }
          setHasMore(false);
          return;
        }

        const items = res.data.data?.items ?? [];
        if (append) {
          setWorks((prev) => [...prev, ...items]);
        } else {
          setWorks(items);
        }

        const totalPages = res.data.data?.total_pages ?? 1;
        setHasMore(pageNum < totalPages);
        setPage(pageNum);
      } catch (error) {
        console.error("加载作品集作品失败", error);
        if (!append) {
          setWorks([]);
        }
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [collectionId],
  );

  React.useEffect(() => {
    loadCollection();
    loadWorks(1, false);
  }, [loadCollection, loadWorks]);

  React.useEffect(() => {
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

  return (
    <AdminLayout
      title={`作品集：${collectionName}`}
      breadcrumbs={[
        { label: "作品集管理", href: "/collections" },
        { label: collectionName },
      ]}
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => navigate("/collections")}
            className="inline-flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            返回作品集
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">加载中...</p>
          </div>
        ) : works.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">该作品集暂无作品</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
              {works.map((work) => (
                <WorkCard
                  key={work.id}
                  work={work}
                  onPreview={() =>
                    navigate(`/works/${work.id}/preview`, {
                      state: {
                        from: "collections",
                        collectionId,
                        collectionName,
                      },
                    })
                  }
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
    </AdminLayout>
  );
}
