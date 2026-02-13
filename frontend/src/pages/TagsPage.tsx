import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { tagService } from "@/services";
import type { Tag } from "@/types/api";
import { useAuthStore } from "@/stores";
import { Search, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ModalMode = "create" | "edit";

export function TagsPage() {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<Tag[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [modalName, setModalName] = useState("");
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [error, setError] = useState("");
  const [deleteTag, setDeleteTag] = useState<Tag | null>(null);

  const handleLogout = () => {
    clearAuth();
    localStorage.removeItem("token");
    navigate("/login");
  };

  const loadTags = async () => {
    setLoading(true);
    try {
      const res = await tagService.list({
        keyword: keyword.trim() || undefined,
        include_count: true,
      });
      if (res.data.code === 0) {
        setTags(res.data.data?.items ?? []);
      }
    } catch (err) {
      console.error("加载标签失败", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  const openCreate = () => {
    setModalMode("create");
    setModalName("");
    setEditingTag(null);
    setError("");
    setModalOpen(true);
  };

  const openEdit = (tag: Tag) => {
    setModalMode("edit");
    setModalName(tag.name);
    setEditingTag(tag);
    setError("");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!modalName.trim()) {
      setError("请输入标签名称");
      return;
    }
    try {
      if (modalMode === "create") {
        const res = await tagService.create({ name: modalName.trim() });
        if (res.data.code !== 0) {
          setError(res.data.message || "创建失败");
          return;
        }
      } else if (editingTag) {
        const res = await tagService.update(editingTag.id, {
          name: modalName.trim(),
        });
        if (res.data.code !== 0) {
          setError(res.data.message || "更新失败");
          return;
        }
      }
      setModalOpen(false);
      loadTags();
    } catch (err: any) {
      setError(err.response?.data?.message || "保存失败");
    }
  };

  const handleDelete = async () => {
    if (!deleteTag) return;
    try {
      await tagService.delete(deleteTag.id);
      setDeleteTag(null);
      loadTags();
    } catch (err) {
      console.error("删除标签失败", err);
    }
  };

  const rows = useMemo(() => tags, [tags]);

  return (
    <AdminLayout
      title="标签管理"
      breadcrumbs={[{ label: "标签管理" }]}
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
                  if (e.key === "Enter") loadTags();
                }}
                placeholder="搜索标签"
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
            <Button onClick={loadTags}>
              <Search className="h-4 w-4 mr-1" />
              搜索
            </Button>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            新建标签
          </Button>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标签名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>关联作品数</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    暂无标签
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((tag) => (
                  <TableRow key={tag.id}>
                    <TableCell className="text-foreground">
                      {tag.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {tag.is_system ? "系统标签" : "普通标签"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {tag.work_count ?? "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {tag.is_system ? (
                        <span className="text-xs text-muted-foreground">
                          不可编辑
                        </span>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(tag)}
                          >
                            编辑
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setDeleteTag(tag)}
                              >
                                删除
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  确认删除标签
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  确定要删除标签 "{deleteTag?.name}"
                                  吗？此操作无法撤销。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel
                                  onClick={() => setDeleteTag(null)}
                                >
                                  取消
                                </AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete}>
                                  删除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {modalMode === "create" ? "新建标签" : "编辑标签"}
            </DialogTitle>
            <DialogDescription>
              请输入标签名称，支持中文、英文、数字
            </DialogDescription>
          </DialogHeader>
          {error && <div className="text-sm text-destructive">{error}</div>}
          <div className="space-y-2">
            <Label>标签名称</Label>
            <Input
              value={modalName}
              onChange={(e) => setModalName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
