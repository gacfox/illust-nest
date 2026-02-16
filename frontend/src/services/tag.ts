import api from "@/services/api";
import type {
  ApiResponse,
  Tag,
  CreateTagRequest,
  UpdateTagRequest,
  BatchCreateTagsRequest,
  BatchCreateTagsResponse,
} from "@/types/api";

export const tagService = {
  list: (params?: { keyword?: string; include_count?: boolean }) =>
    api.get<ApiResponse<{ items: Tag[] }>>("/api/tags", { params }),

  listPublic: (params?: { keyword?: string; include_count?: boolean }) =>
    api.get<ApiResponse<{ items: Tag[] }>>("/api/public/tags", { params }),

  create: (data: CreateTagRequest) =>
    api.post<ApiResponse<Tag>>("/api/tags", data),

  update: (id: number, data: UpdateTagRequest) =>
    api.put<ApiResponse<Tag>>(`/api/tags/${id}`, data),

  delete: (id: number) => api.delete<ApiResponse<void>>(`/api/tags/${id}`),

  batchCreate: (data: BatchCreateTagsRequest) =>
    api.post<ApiResponse<BatchCreateTagsResponse>>("/api/tags/batch", data),
};
