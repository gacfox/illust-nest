import api from "@/services/api";
import type {
  ApiResponse,
  Work,
  UpdateWorkRequest,
  WorkListParams,
  WorkPagedResult,
  ImageUploadResponse,
  CheckDuplicateImagesRequest,
  CheckDuplicateImagesResponse,
} from "@/types/api";

export const workService = {
  list: (params?: WorkListParams) =>
    api.get<ApiResponse<WorkPagedResult>>("/api/works", { params }),

  create: (data: FormData) =>
    api.post<ApiResponse<Work>>("/api/works", data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  get: (id: number) => api.get<ApiResponse<Work>>(`/api/works/${id}`),

  update: (id: number, data: UpdateWorkRequest) =>
    api.put<ApiResponse<Work>>(`/api/works/${id}`, data),

  delete: (id: number) => api.delete<ApiResponse<void>>(`/api/works/${id}`),

  batchDelete: (ids: number[]) =>
    api.delete<ApiResponse<void>>("/api/works/batch", {
      data: { ids },
    }),

  batchUpdatePublic: (ids: number[], isPublic: boolean) =>
    api.put<ApiResponse<void>>("/api/works/batch/public", {
      ids,
      is_public: isPublic,
    }),

  addImages: (id: number, formData: FormData) =>
    api.post<ApiResponse<ImageUploadResponse>>(
      `/api/works/${id}/images`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    ),

  deleteImage: (id: number, imageId: number) =>
    api.delete<ApiResponse<void>>(`/api/works/${id}/images/${imageId}`),

  updateImageOrder: (id: number, imageIds: number[]) =>
    api.put<ApiResponse<void>>(`/api/works/${id}/images/order`, {
      image_ids: imageIds,
    }),

  exportImages: () =>
    api.get("/api/works/export/images", {
      responseType: "blob",
    }),

  checkDuplicateImages: (data: CheckDuplicateImagesRequest) =>
    api.post<ApiResponse<CheckDuplicateImagesResponse>>(
      "/api/works/images/duplicates",
      data,
    ),
};

export const imageService = {
  getOriginal: (path: string) => {
    const normalized = normalizeImagePath(path, ["uploads/originals/"]);
    return `/api/images/originals${normalized}`;
  },

  getThumbnail: (path: string) => {
    const normalized = normalizeImagePath(path, ["uploads/thumbnails/"]);
    return `/api/images/thumbnails${normalized}`;
  },
  getTranscoded: (path: string) => {
    const normalized = normalizeImagePath(path, ["uploads/transcoded/"]);
    return `/api/images/transcoded${normalized}`;
  },
  fetchOriginal: (path: string) =>
    api.get(imageService.getOriginal(path), { responseType: "blob" }),
  fetchTranscoded: (path: string) =>
    api.get(imageService.getTranscoded(path), { responseType: "blob" }),
  fetchThumbnail: (path: string) =>
    api.get(imageService.getThumbnail(path), { responseType: "blob" }),
};

function normalizeImagePath(path: string, prefixes: string[]) {
  if (!path) return "";
  let cleaned = path.startsWith("/") ? path.slice(1) : path;
  for (const prefix of prefixes) {
    if (cleaned.startsWith(prefix)) {
      cleaned = cleaned.slice(prefix.length);
      break;
    }
  }
  return `/${cleaned}`;
}
