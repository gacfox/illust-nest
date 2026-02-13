import api from "@/services/api";
import type {
  ApiResponse,
  Collection,
  CreateCollectionRequest,
  UpdateCollectionRequest,
  AddWorksRequest,
  UpdateSortOrderRequest,
  UpdateWorkSortOrderRequest,
  WorksResult,
} from "@/types/api";

export const collectionService = {
  getTree: () => api.get<ApiResponse<Collection[]>>("/api/collections/tree"),

  get: (id: number) =>
    api.get<ApiResponse<Collection>>(`/api/collections/${id}`),

  getWorks: (id: number) =>
    api.get<ApiResponse<WorksResult>>(`/api/collections/${id}/works`),

  create: (data: CreateCollectionRequest) =>
    api.post<ApiResponse<Collection>>("/api/collections", data),

  update: (id: number, data: UpdateCollectionRequest) =>
    api.put<ApiResponse<Collection>>(`/api/collections/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<void>>(`/api/collections/${id}`),

  updateSortOrder: (data: UpdateSortOrderRequest) =>
    api.put<ApiResponse<void>>("/api/collections/order", data),

  addWorks: (id: number, data: AddWorksRequest) =>
    api.post<ApiResponse<void>>(`/api/collections/${id}/works`, data),

  removeWorks: (id: number, workIds: number[]) =>
    api.delete<ApiResponse<void>>(`/api/collections/${id}/works`, {
      params: { ids: workIds.join(",") },
    }),

  updateWorkSortOrder: (id: number, data: UpdateWorkSortOrderRequest) =>
    api.put<ApiResponse<void>>(`/api/collections/${id}/works/order`, data),
};
