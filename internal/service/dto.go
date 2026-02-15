package service

import "illust-nest/internal/model"

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	User      *UserInfo `json:"user"`
	Token     string    `json:"token"`
	ExpiresAt string    `json:"expires_at"`
}

type UserInfo struct {
	ID        uint   `json:"id"`
	Username  string `json:"username"`
	CreatedAt string `json:"created_at"`
}

type SystemStatus struct {
	Initialized          bool   `json:"initialized"`
	PublicGalleryEnabled bool   `json:"public_gallery_enabled"`
	SiteTitle            string `json:"site_title"`
}

type InitRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50"`
	Password string `json:"password" binding:"required,min=6,max=100"`
}

type SystemSettings struct {
	PublicGalleryEnabled bool   `json:"public_gallery_enabled"`
	SiteTitle            string `json:"site_title"`
	ImageMagickEnabled   bool   `json:"imagemagick_enabled"`
	ImageMagickVersion   string `json:"imagemagick_version"`
}

type ImageMagickTestResult struct {
	Available bool   `json:"available"`
	Command   string `json:"command"`
	Message   string `json:"message"`
}

type SystemStatistics struct {
	WorkCount            int64                 `json:"work_count"`
	ImageCount           int64                 `json:"image_count"`
	TagCount             int64                 `json:"tag_count"`
	CollectionCount      int64                 `json:"collection_count"`
	DuplicateImageGroups []DuplicateImageGroup `json:"duplicate_image_groups"`
}

type DuplicateImageGroup struct {
	ImageHash            string                  `json:"image_hash"`
	TotalImages          int64                   `json:"total_images"`
	PreviewThumbnailPath string                  `json:"preview_thumbnail_path,omitempty"`
	Works                []DuplicateImageWorkRef `json:"works"`
}

type DuplicateImageWorkRef struct {
	WorkID         uint  `json:"work_id"`
	DuplicateCount int64 `json:"duplicate_count"`
}

type CreateTagRequest struct {
	Name string `json:"name" binding:"required,min=1,max=50"`
}

type UpdateTagRequest struct {
	Name string `json:"name" binding:"required,min=1,max=50"`
}

type BatchCreateTagsRequest struct {
	Names []string `json:"names" binding:"required,min=1"`
}

type BatchCreateTagsResponse struct {
	Tags    []*model.Tag `json:"tags"`
	Skipped []string     `json:"skipped"`
}

type TagInfo struct {
	ID        uint   `json:"id"`
	Name      string `json:"name"`
	IsSystem  bool   `json:"is_system"`
	CreatedAt string `json:"created_at"`
	WorkCount int    `json:"work_count,omitempty"`
}

type CreateWorkRequest struct {
	Title       string `json:"title" binding:"required,max=200"`
	Description string `json:"description"`
	Rating      int    `json:"rating" binding:"min=0,max=5"`
	IsPublic    bool   `json:"is_public"`
	TagIDs      []uint `json:"tag_ids"`
}

type UpdateWorkRequest struct {
	Title       string `json:"title" binding:"max=200"`
	Description string `json:"description"`
	Rating      int    `json:"rating" binding:"min=0,max=5"`
	IsPublic    *bool  `json:"is_public"`
	TagIDs      []uint `json:"tag_ids"`
}

type WorkListParams struct {
	Page      int
	PageSize  int
	Keyword   string
	TagIDs    []uint
	RatingMin int
	RatingMax int
	IsPublic  *bool
	SortBy    string
	SortOrder string
}

type WorkPagedResult struct {
	Items      []*WorkInfo `json:"items"`
	Total      int64       `json:"total"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
	TotalPages int         `json:"total_pages"`
}

type WorkInfo struct {
	ID          uint         `json:"id"`
	Title       string       `json:"title"`
	Description string       `json:"description"`
	Rating      int          `json:"rating"`
	IsPublic    bool         `json:"is_public"`
	CreatedAt   string       `json:"created_at"`
	UpdatedAt   string       `json:"updated_at"`
	CoverImage  *ImageInfo   `json:"cover_image,omitempty"`
	Images      []ImageInfo  `json:"images,omitempty"`
	ImageCount  int          `json:"image_count,omitempty"`
	Tags        []*model.Tag `json:"tags,omitempty"`
}

type ImageInfo struct {
	ID             uint   `json:"id"`
	ThumbnailPath  string `json:"thumbnail_path"`
	OriginalPath   string `json:"original_path,omitempty"`
	TranscodedPath string `json:"transcoded_path,omitempty"`
	ImageHash      string `json:"image_hash,omitempty"`
	FileSize       int64  `json:"file_size,omitempty"`
	Width          int    `json:"width"`
	Height         int    `json:"height"`
	SortOrder      int    `json:"sort_order"`
}

type CreateCollectionRequest struct {
	Name        string `json:"name" binding:"required,min=1,max=100"`
	Description string `json:"description"`
	ParentID    *uint  `json:"parent_id,omitempty"`
}

type UpdateCollectionRequest struct {
	Name        string `json:"name" binding:"min=1,max=100"`
	Description string `json:"description"`
	ParentID    *uint  `json:"parent_id,omitempty"`
}

type CollectionInfo struct {
	ID          uint   `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	SortOrder   int    `json:"sort_order"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
	WorkCount   int    `json:"work_count"`
}

type AddWorksRequest struct {
	WorkIDs []uint `json:"work_ids" binding:"required,min=1"`
}

type RemoveWorksRequest struct {
	WorkIDs []uint `json:"work_ids" binding:"required,min=1"`
}

type SyncWorkCollectionsRequest struct {
	CollectionIDs []uint `json:"collection_ids" binding:"required"`
}

type UpdateSortOrderRequest struct {
	CollectionIDs []uint `json:"collection_ids" binding:"required,min=1"`
}

type UpdateWorkSortOrderRequest struct {
	WorkIDs []uint `json:"work_ids" binding:"required,min=1"`
}

type WorksResult struct {
	Works []*WorkInfo `json:"works"`
}

type UploadedImage struct {
	StoragePath      string `json:"storage_path"`
	ThumbnailPath    string `json:"thumbnail_path"`
	TranscodedPath   string `json:"transcoded_path,omitempty"`
	ImageHash        string `json:"image_hash,omitempty"`
	FileSize         int64  `json:"file_size"`
	Width            int    `json:"width"`
	Height           int    `json:"height"`
	OriginalFilename string `json:"original_filename"`
}

type ImageUploadResponse struct {
	Images []*UploadedImage `json:"images"`
}

type ExportImageRecord struct {
	Path        string `json:"path"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Tags        string `json:"tags"`
	Rating      int    `json:"rating"`
	CreatedAt   string `json:"created_at"`
}

type DuplicateImageCheckRequest struct {
	ImageHashes   []string `json:"image_hashes" binding:"required,min=1"`
	ExcludeWorkID *uint    `json:"exclude_work_id,omitempty"`
}

type DuplicateImageInfo struct {
	ImageHash string `json:"image_hash"`
	WorkID    uint   `json:"work_id"`
	ImageID   uint   `json:"image_id"`
}

type DuplicateImageCheckResponse struct {
	Duplicates []DuplicateImageInfo `json:"duplicates"`
}
