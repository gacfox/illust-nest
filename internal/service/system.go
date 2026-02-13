package service

import (
	"illust-nest/internal/middleware"
	"illust-nest/internal/repository"
)

type SystemService struct {
	settingRepo *repository.SettingRepository
	userRepo    *repository.UserRepository
	authService *AuthService
}

func NewSystemService(settingRepo *repository.SettingRepository, userRepo *repository.UserRepository, authService *AuthService) *SystemService {
	return &SystemService{
		settingRepo: settingRepo,
		userRepo:    userRepo,
		authService: authService,
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
		SiteTitle: "Illust Nest",
	}

	if enabled, err := s.settingRepo.Get("public_gallery_enabled"); err == nil {
		settings.PublicGalleryEnabled = enabled.Value == "true"
	}

	if title, err := s.settingRepo.Get("site_title"); err == nil {
		settings.SiteTitle = title.Value
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
	return nil
}

func boolToString(b bool) string {
	if b {
		return "true"
	}
	return "false"
}
