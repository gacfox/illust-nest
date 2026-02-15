package service

import (
	"illust-nest/internal/middleware"
	"illust-nest/internal/repository"
	"sort"
	"strings"
)

type SystemService struct {
	settingRepo    *repository.SettingRepository
	userRepo       *repository.UserRepository
	workRepo       *repository.WorkRepository
	tagRepo        *repository.TagRepository
	collectionRepo *repository.CollectionRepository
	authService    *AuthService
}

func NewSystemService(
	settingRepo *repository.SettingRepository,
	userRepo *repository.UserRepository,
	workRepo *repository.WorkRepository,
	tagRepo *repository.TagRepository,
	collectionRepo *repository.CollectionRepository,
	authService *AuthService,
) *SystemService {
	return &SystemService{
		settingRepo:    settingRepo,
		userRepo:       userRepo,
		workRepo:       workRepo,
		tagRepo:        tagRepo,
		collectionRepo: collectionRepo,
		authService:    authService,
	}
}

func (s *SystemService) GetStatus() (*SystemStatus, error) {
	status := &SystemStatus{
		SiteTitle: "Illust Nest",
	}

	if initialized, err := s.settingRepo.Get("initialized"); err == nil {
		status.Initialized = initialized.Value == "true"
	}

	if enabled, err := s.settingRepo.Get("public_gallery_enabled"); err == nil {
		status.PublicGalleryEnabled = enabled.Value == "true"
	}

	if title, err := s.settingRepo.Get("site_title"); err == nil {
		status.SiteTitle = title.Value
	}

	return status, nil
}

func (s *SystemService) Init(req *InitRequest) (*LoginResponse, error) {
	status, err := s.GetStatus()
	if err != nil {
		return nil, err
	}

	if status.Initialized {
		return nil, &ValidationError{Message: "System already initialized", Code: 3002}
	}

	user, err := s.authService.CreateUser(req.Username, req.Password)
	if err != nil {
		return nil, err
	}

	if err := s.settingRepo.Set("initialized", "true"); err != nil {
		return nil, err
	}

	token, expiresAt, err := middleware.GenerateToken(user.ID, user.Username)
	if err != nil {
		return nil, err
	}

	return &LoginResponse{
		User: &UserInfo{
			ID:        user.ID,
			Username:  user.Username,
			CreatedAt: user.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		},
		Token:     token,
		ExpiresAt: expiresAt.Format("2006-01-02T15:04:05Z07:00"),
	}, nil
}

func (s *SystemService) GetSettings() (*SystemSettings, error) {
	settings := &SystemSettings{
		SiteTitle:          "Illust Nest",
		ImageMagickEnabled: false,
		ImageMagickVersion: ImageMagickVersionV7,
	}

	if enabled, err := s.settingRepo.Get("public_gallery_enabled"); err == nil {
		settings.PublicGalleryEnabled = enabled.Value == "true"
	}

	if title, err := s.settingRepo.Get("site_title"); err == nil {
		settings.SiteTitle = title.Value
	}
	if enabled, err := s.settingRepo.Get("imagemagick_enabled"); err == nil {
		settings.ImageMagickEnabled = enabled.Value == "true"
	}
	if version, err := s.settingRepo.Get("imagemagick_version"); err == nil {
		settings.ImageMagickVersion = normalizeImageMagickVersion(version.Value)
	}

	return settings, nil
}

func (s *SystemService) UpdateSettings(settings *SystemSettings) error {
	if err := s.settingRepo.Set("public_gallery_enabled", boolToString(settings.PublicGalleryEnabled)); err != nil {
		return err
	}
	if err := s.settingRepo.Set("site_title", settings.SiteTitle); err != nil {
		return err
	}
	settings.ImageMagickVersion = normalizeImageMagickVersion(settings.ImageMagickVersion)
	if err := s.settingRepo.Set("imagemagick_enabled", boolToString(settings.ImageMagickEnabled)); err != nil {
		return err
	}
	if err := s.settingRepo.Set("imagemagick_version", settings.ImageMagickVersion); err != nil {
		return err
	}
	return nil
}

func (s *SystemService) TestImageMagickCommand(versionOverride string) (*ImageMagickTestResult, error) {
	version := normalizeImageMagickVersion(versionOverride)
	if strings.TrimSpace(versionOverride) == "" {
		settings, err := s.GetSettings()
		if err != nil {
			return nil, err
		}
		version = normalizeImageMagickVersion(settings.ImageMagickVersion)
	}
	command, err := resolveImageMagickCommand(version)
	if err != nil {
		return nil, err
	}

	message, err := testImageMagickCommand(version)
	if err != nil {
		return &ImageMagickTestResult{
			Available: false,
			Command:   command,
			Message:   err.Error(),
		}, nil
	}
	return &ImageMagickTestResult{
		Available: true,
		Command:   command,
		Message:   message,
	}, nil
}

func (s *SystemService) GetStatistics() (*SystemStatistics, error) {
	workCount, err := s.workRepo.Count()
	if err != nil {
		return nil, err
	}

	imageCount, err := s.workRepo.CountImages()
	if err != nil {
		return nil, err
	}

	tagCount, err := s.tagRepo.CountNonSystem()
	if err != nil {
		return nil, err
	}

	collectionCount, err := s.collectionRepo.Count()
	if err != nil {
		return nil, err
	}

	hashCounts, err := s.workRepo.FindDuplicateImageHashCounts()
	if err != nil {
		return nil, err
	}

	duplicateGroups := make([]DuplicateImageGroup, 0, len(hashCounts))
	if len(hashCounts) > 0 {
		hashes := make([]string, 0, len(hashCounts))
		for _, row := range hashCounts {
			if row.ImageHash == "" {
				continue
			}
			hashes = append(hashes, row.ImageHash)
		}

		images, err := s.workRepo.FindDuplicateImagesByHashes(hashes, nil)
		if err != nil {
			return nil, err
		}

		worksByHash := make(map[string]map[uint]int64)
		previewByHash := make(map[string]string)
		for _, image := range images {
			if image.ImageHash == "" {
				continue
			}
			if _, ok := worksByHash[image.ImageHash]; !ok {
				worksByHash[image.ImageHash] = make(map[uint]int64)
			}
			worksByHash[image.ImageHash][image.WorkID]++
			if _, ok := previewByHash[image.ImageHash]; !ok && image.ThumbnailPath != "" {
				previewByHash[image.ImageHash] = image.ThumbnailPath
			}
		}

		for _, row := range hashCounts {
			workCounter := worksByHash[row.ImageHash]
			works := make([]DuplicateImageWorkRef, 0, len(workCounter))
			for workID, count := range workCounter {
				works = append(works, DuplicateImageWorkRef{
					WorkID:         workID,
					DuplicateCount: count,
				})
			}
			sort.Slice(works, func(i, j int) bool {
				if works[i].DuplicateCount == works[j].DuplicateCount {
					return works[i].WorkID < works[j].WorkID
				}
				return works[i].DuplicateCount > works[j].DuplicateCount
			})

			duplicateGroups = append(duplicateGroups, DuplicateImageGroup{
				ImageHash:            row.ImageHash,
				TotalImages:          row.Count,
				PreviewThumbnailPath: previewByHash[row.ImageHash],
				Works:                works,
			})
		}
	}

	return &SystemStatistics{
		WorkCount:            workCount,
		ImageCount:           imageCount,
		TagCount:             tagCount,
		CollectionCount:      collectionCount,
		DuplicateImageGroups: duplicateGroups,
	}, nil
}

func boolToString(b bool) string {
	if b {
		return "true"
	}
	return "false"
}
