// API Response Base
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

// User
export interface User {
  id: number;
  username: string;
  created_at: string;
}

// Auth
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  expires_at: string;
}

export interface ChangePasswordRequest {
  new_password: string;
}

// System
export interface SystemStatus {
  initialized: boolean;
  public_gallery_enabled: boolean;
  site_title: string;
}

export interface InitRequest {
  username: string;
  password: string;
}

export interface SystemSettings {
  public_gallery_enabled: boolean;
  site_title: string;
}

// Tag
export interface Tag {
  id: number;
  name: string;
  is_system: boolean;
  created_at: string;
  work_count?: number;
}

export interface CreateTagRequest {
  name: string;
}

export interface UpdateTagRequest {
  name: string;
}

export interface BatchCreateTagsRequest {
  names: string[];
}

export interface BatchCreateTagsResponse {
  tags: Tag[];
  skipped: string[];
}

// Work
export interface Image {
  id: number;
  thumbnail_path: string;
  original_path?: string;
  file_size?: number;
  width: number;
  height: number;
  sort_order: number;
}

export interface Work {
  id: number;
  title: string;
  description: string;
  rating: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  cover_image?: Image;
  image_count?: number;
  tags?: Tag[];
}

export interface CreateWorkRequest {
  title: string;
  description?: string;
  rating?: number;
  is_public?: boolean;
  tag_ids?: number[];
}

export interface UpdateWorkRequest {
  title?: string;
  description?: string;
  rating?: number;
  is_public?: boolean;
  tag_ids?: number[];
}

export interface WorkListParams {
  page?: number;
  page_size?: number;
  keyword?: string;
  tag_ids?: number[] | string;
  rating_min?: number;
  rating_max?: number;
  is_public?: boolean;
  sort_by?: string;
  sort_order?: string;
}

export interface WorkPagedResult {
  items: Work[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// Collection
export interface CollectionPath {
  id: number;
  name: string;
}

export interface Collection {
  id: number;
  name: string;
  description: string;
  parent_id: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  work_count: number;
  path?: CollectionPath[];
  sub_collections?: Collection[];
}

export interface CreateCollectionRequest {
  name: string;
  description?: string;
  parent_id?: number | null;
}

export interface UpdateCollectionRequest {
  name?: string;
  description?: string;
  parent_id?: number | null;
}

export interface AddWorksRequest {
  work_ids: number[];
}

export interface RemoveWorksRequest {
  work_ids: number[];
}

export interface SyncWorkCollectionsRequest {
  collection_ids: number[];
}

export interface UpdateSortOrderRequest {
  collection_ids: number[];
}

export interface UpdateWorkSortOrderRequest {
  work_ids: number[];
}

export interface WorksResult {
  works: Work[];
}

// Image Upload
export interface UploadedImage {
  storage_path: string;
  thumbnail_path: string;
  file_size: number;
  width: number;
  height: number;
  original_filename: string;
}

export interface ImageUploadResponse {
  images: UploadedImage[];
}
