import api from "@/services/api";
import type {
  ApiResponse,
  SystemStatus,
  InitRequest,
  SystemSettings,
  SystemStatistics,
  ImageMagickTestResult,
} from "@/types/api";

export const systemService = {
  getStatus: () => api.get<ApiResponse<SystemStatus>>("/api/system/status"),

  init: (data: InitRequest) =>
    api.post<ApiResponse<void>>("/api/system/init", data),

  getSettings: () =>
    api.get<ApiResponse<SystemSettings>>("/api/system/settings"),

  updateSettings: (data: Partial<SystemSettings>) =>
    api.put<ApiResponse<void>>("/api/system/settings", data),

  getStatistics: () =>
    api.get<ApiResponse<SystemStatistics>>("/api/system/statistics"),

  testImageMagick: (version?: "v6" | "v7") =>
    api.get<ApiResponse<ImageMagickTestResult>>(
      "/api/system/imagemagick/test",
      {
        params: version ? { version } : undefined,
      },
    ),
};
