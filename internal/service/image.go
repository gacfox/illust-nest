package service

import (
	"crypto/rand"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/disintegration/imaging"
	_ "golang.org/x/image/webp"
)

const (
	MaxUploadFileSizeMB    int64 = 20
	MaxUploadFileSizeBytes       = MaxUploadFileSizeMB * 1024 * 1024
	thumbnailMaxWidth            = 400
	thumbnailQuality             = 85
)

var allowedUploadFormats = map[string]struct{}{
	"image/jpeg": {},
	"image/png":  {},
	"image/gif":  {},
	"image/webp": {},
}

type ImageService struct{}

func NewImageService() *ImageService {
	return &ImageService{}
}

func (s *ImageService) UploadImages(files []*multipart.FileHeader) ([]*UploadedImage, error) {
	var uploadedImages []*UploadedImage

	for _, file := range files {
		uploadedImage, err := s.processImage(file)
		if err != nil {
			return nil, err
		}
		uploadedImages = append(uploadedImages, uploadedImage)
	}

	return uploadedImages, nil
}

func (s *ImageService) processImage(file *multipart.FileHeader) (*UploadedImage, error) {
	src, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer src.Close()

	img, _, err := image.Decode(src)
	if err != nil {
		return nil, err
	}

	width := img.Bounds().Dx()
	height := img.Bounds().Dy()

	uuid := generateUUID()
	ext := filepath.Ext(file.Filename)
	originalPath := s.getStoragePath("originals", uuid, ext)
	thumbnailPath := s.getStoragePath("thumbnails", uuid, ".jpg")

	originalDir := filepath.Dir(originalPath)
	if err := os.MkdirAll(originalDir, 0755); err != nil {
		return nil, err
	}

	thumbnailDir := filepath.Dir(thumbnailPath)
	if err := os.MkdirAll(thumbnailDir, 0755); err != nil {
		return nil, err
	}

	src.Seek(0, 0)
	dst, err := os.Create(originalPath)
	if err != nil {
		return nil, err
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return nil, err
	}

	thumbnailImg := imaging.Resize(img, thumbnailMaxWidth, 0, imaging.Lanczos)
	if err := imaging.Save(thumbnailImg, thumbnailPath, imaging.JPEGQuality(thumbnailQuality)); err != nil {
		return nil, err
	}

	return &UploadedImage{
		StoragePath:      strings.TrimPrefix(originalPath, "./data/"),
		ThumbnailPath:    strings.TrimPrefix(thumbnailPath, "./data/"),
		FileSize:         file.Size,
		Width:            width,
		Height:           height,
		OriginalFilename: file.Filename,
	}, nil
}

func (s *ImageService) getStoragePath(subDir, uuid, ext string) string {
	now := time.Now()
	year := now.Format("2006")
	month := now.Format("01")
	return fmt.Sprintf("./data/uploads/%s/%s/%s/%s%s", subDir, year, month, uuid, ext)
}

func (s *ImageService) DeleteImage(storagePath, thumbnailPath string) error {
	originalFullPath := filepath.Join("./data", storagePath)
	thumbnailFullPath := filepath.Join("./data", thumbnailPath)

	if err := os.Remove(originalFullPath); err != nil && !os.IsNotExist(err) {
		return err
	}

	if err := os.Remove(thumbnailFullPath); err != nil && !os.IsNotExist(err) {
		return err
	}

	return nil
}

func generateUUID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

func (s *ImageService) ValidateFormat(file *multipart.FileHeader) bool {
	contentType := file.Header.Get("Content-Type")
	_, ok := allowedUploadFormats[contentType]
	return ok
}
