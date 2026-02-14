import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  FolderOpen,
  RefreshCw,
  Image as ImageIcon,
  Plus,
  Pencil,
  Eye,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { collectionService } from "@/services";
import { useAuthStore } from "@/stores";
import type { Collection } from "@/types/api";

type CollectionTreeData = Collection[] | { items?: Collection[] };

export function CollectionsPage() {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [collections, setCollections] = React.useState<Collection[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [formError, setFormError] = React.useState("");
  const [editOpen, setEditOpen] = React.useState(false);
  const [updating, setUpdating] = React.useState(false);
  const [editId, setEditId] = React.useState<number | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [editError, setEditError] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<Collection | null>(
    null,
  );
  const [deleting, setDeleting] = React.useState(false);

  const handleLogout = () => {
    clearAuth();
    localStorage.removeItem("token");
    navigate("/login");
  };

  const loadCollections = async () => {
    setLoading(true);
    try {
      const res = await collectionService.getTree();
      if (res.data.code !== 0) {
        setCollections([]);
        return;
      }

      const payload = res.data.data as CollectionTreeData;
      const items = Array.isArray(payload) ? payload : (payload.items ?? []);
      setCollections(items);
    } catch (error) {
      console.error("加载作品集失败", error);
      setCollections([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadCollections();
  }, []);

  const openCreateDialog = () => {
    setName("");
    setDescription("");
    setFormError("");
    setCreateOpen(true);
  };

  const openEditDialog = (collection: Collection) => {
    setEditId(collection.id);
    setEditName(collection.name);
    setEditDescription(collection.description || "");
    setEditError("");
    setEditOpen(true);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setFormError("请输入作品集名称");
      return;
    }

    setCreating(true);
    setFormError("");
    try {
      const res = await collectionService.create({
        name: name.trim(),
        description: description.trim(),
      });
      if (res.data.code !== 0) {
        setFormError(res.data.message || "创建失败");
        return;
      }

      setCreateOpen(false);
      toast.success("作品集创建成功");
      await loadCollections();
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } })
          .response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response!
              .data!.message!
          : "创建失败";
      setFormError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async () => {
    if (editId === null) {
      return;
    }
    if (!editName.trim()) {
      setEditError("请输入作品集名称");
      return;
    }

    setUpdating(true);
    setEditError("");
    try {
      const res = await collectionService.update(editId, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
      if (res.data.code !== 0) {
        setEditError(res.data.message || "更新失败");
        return;
      }

      setEditOpen(false);
      toast.success("作品集更新成功");
      await loadCollections();
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } })
          .response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response!
              .data!.message!
          : "更新失败";
      setEditError(message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);
    try {
      const res = await collectionService.delete(deleteTarget.id);
      if (res.data.code !== 0) {
        toast.error(res.data.message || "删除失败");
        return;
      }

      toast.success("作品集已删除");
      setDeleteTarget(null);
      await loadCollections();
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } })
          .response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response!
              .data!.message!
          : "删除失败";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminLayout
      title="作品集管理"
      breadcrumbs={[{ label: "作品集管理" }]}
      onLogout={handleLogout}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={loadCollections}>
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            新建作品集
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            加载中...
          </div>
        ) : collections.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            暂无作品集
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-4">
            {collections.map((collection) => (
              <div
                key={collection.id}
                className="group w-full overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-lg cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/collections/${collection.id}/works`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/collections/${collection.id}/works`);
                  }
                }}
              >
                <div className="relative px-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/80 text-primary">
                      <FolderOpen className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-semibold tracking-tight text-foreground truncate">
                      {collection.name}
                    </h3>
                  </div>
                </div>

                <div className="relative px-4 mb-2">
                  <p className="min-h-5 text-xs leading-5 text-muted-foreground truncate">
                    {collection.description || "暂无描述"}
                  </p>
                </div>

                <div className="relative flex items-center justify-between border-t border-border/60 px-2 py-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1">
                    <ImageIcon className="h-3.5 w-3.5" />
                    {collection.work_count}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="查看作品集"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/collections/${collection.id}/works`);
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="编辑作品集"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDialog(collection);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="删除作品集"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(collection);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建作品集</DialogTitle>
            <DialogDescription>
              创建一个新的作品集用于归档和组织作品
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="text-sm text-destructive">{formError}</div>
          )}

          <div className="space-y-2">
            <Label htmlFor="collection-name">名称</Label>
            <Input
              id="collection-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="例如：角色设定集"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="collection-desc">描述</Label>
            <Textarea
              id="collection-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="可选，简要说明作品集内容"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              取消
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑作品集</DialogTitle>
            <DialogDescription>修改作品集名称与描述信息</DialogDescription>
          </DialogHeader>

          {editError && (
            <div className="text-sm text-destructive">{editError}</div>
          )}

          <div className="space-y-2">
            <Label htmlFor="collection-edit-name">名称</Label>
            <Input
              id="collection-edit-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={100}
              placeholder="例如：角色设定集"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="collection-edit-desc">描述</Label>
            <Textarea
              id="collection-edit-desc"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={4}
              placeholder="可选，简要说明作品集内容"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={updating}
            >
              取消
            </Button>
            <Button onClick={handleUpdate} disabled={updating}>
              {updating ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除作品集？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除作品集「{deleteTarget?.name ?? ""}」，但不会删除其中的作品。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
