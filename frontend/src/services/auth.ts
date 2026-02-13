import api from "@/services/api";
import type {
  ApiResponse,
  LoginRequest,
  LoginResponse,
  ChangePasswordRequest,
  User,
} from "@/types/api";

export const authService = {
  login: (data: LoginRequest) =>
    api.post<ApiResponse<LoginResponse>>("/api/auth/login", data),

  me: () => api.get<ApiResponse<User>>("/api/auth/me"),

  changePassword: (data: ChangePasswordRequest) =>
    api.put<ApiResponse<void>>("/api/auth/password", data),

  refreshToken: () =>
    api.post<ApiResponse<{ token: string; expires_at: string }>>(
      "/api/auth/refresh",
    ),
};
