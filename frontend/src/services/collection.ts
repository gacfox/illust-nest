import api from "@/services/api";
import type {
  ApiResponse,
  Collection,
  CreateCollectionRequest,
  UpdateCollectionRequest,
  AddWorksRequest,
  SyncWorkCollectionsRequest,
  UpdateSortOrderRequest,
  UpdateWorkSortOrderRequest,
  WorkListParams,
  WorkPagedResult,
} from "@/types/api";

export const collectionService = {
  getTree: () => api.get<ApiResponse<Collection[]>>("/api/collections/tree"),

  getByWork: (workId: number) =>
    api.get<ApiResponse<{ items: Collection[] }>>(
      `/api/collections/by-work/${workId}`,
    ),

  syncByWork: (workId: number, data: SyncWorkCollectionsRequest) =>
    api.put<ApiResponse<void>>(`/api/collections/by-work/${workId}`, data),

  get: (id: number) =>
    api.get<ApiResponse<Collection>>(`/api/collections/${id}`),

  getWorks: (id: number, params?: WorkListParams) =>
    api.get<ApiResponse<WorkPagedResult>>(`/api/collections/${id}/works`, {
      params,
    }),

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
