package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"illust-nest/internal/config"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type ObjectInfo struct {
	Size        int64
	ContentType string
	ModTime     time.Time
}

type StorageProvider interface {
	Put(ctx context.Context, logicalPath string, reader io.Reader, size int64, contentType string) error
	Get(ctx context.Context, logicalPath string) (io.ReadCloser, ObjectInfo, error)
	Stat(ctx context.Context, logicalPath string) (ObjectInfo, error)
	Delete(ctx context.Context, logicalPath string) error
}

var (
	storageProvider     StorageProvider
	storageProviderErr  error
	storageProviderOnce sync.Once
)

func GetStorageProvider() (StorageProvider, error) {
	storageProviderOnce.Do(func() {
		storageProvider, storageProviderErr = newStorageProviderFromConfig()
	})
	return storageProvider, storageProviderErr
}

func newStorageProviderFromConfig() (StorageProvider, error) {
	providerMap := make(map[string]StorageProvider)
	for _, item := range config.GlobalConfig.Storage.Providers {
		name := strings.TrimSpace(item.Name)
		if name == "" {
			return nil, errors.New("storage provider name is required")
		}
		if _, exists := providerMap[name]; exists {
			return nil, fmt.Errorf("duplicate storage provider name: %s", name)
		}

		provider, err := newSingleStorageProvider(item)
		if err != nil {
			return nil, fmt.Errorf("failed to build storage provider %s: %w", name, err)
		}
		providerMap[name] = provider
	}

	mainName := strings.TrimSpace(config.GlobalConfig.Storage.Main)
	if mainName == "" {
		return nil, errors.New("storage.main is required")
	}
	mainProvider, ok := providerMap[mainName]
	if !ok {
		return nil, fmt.Errorf("storage.main provider not found: %s", mainName)
	}

	backupName := strings.TrimSpace(config.GlobalConfig.Storage.Backup)
	if backupName == "" {
		return mainProvider, nil
	}
	if backupName == mainName {
		return nil, errors.New("storage.backup cannot be the same as storage.main")
	}
	backupProvider, ok := providerMap[backupName]
	if !ok {
		return nil, fmt.Errorf("storage.backup provider not found: %s", backupName)
	}

	return &mirroredStorageProvider{
		main:       mainProvider,
		backup:     backupProvider,
		backupMode: strings.ToLower(strings.TrimSpace(config.GlobalConfig.Storage.BackupMode)),
	}, nil
}

func newSingleStorageProvider(item config.StorageProviderItem) (StorageProvider, error) {
	storageType := strings.ToLower(strings.TrimSpace(item.Type))
	switch storageType {
	case "local":
		base := strings.TrimSpace(item.UploadBaseDir)
		if base == "" {
			base = "./data/uploads"
		}
		return &localStorageProvider{baseDir: base}, nil
	case "s3":
		if strings.TrimSpace(item.Endpoint) == "" ||
			strings.TrimSpace(item.Bucket) == "" ||
			strings.TrimSpace(item.AccessKeyID) == "" ||
			strings.TrimSpace(item.SecretAccessKey) == "" {
			return nil, errors.New("invalid s3 storage config: endpoint, bucket, access_key_id, secret_access_key are required")
		}
		opts := &minio.Options{
			Creds:  credentials.NewStaticV4(item.AccessKeyID, item.SecretAccessKey, ""),
			Secure: item.UseSSL,
			Region: strings.TrimSpace(item.Region),
		}
		if item.ForcePathStyle {
			opts.BucketLookup = minio.BucketLookupPath
		}
		client, err := minio.New(strings.TrimSpace(item.Endpoint), opts)
		if err != nil {
			return nil, err
		}
		return &s3StorageProvider{
			client: client,
			bucket: strings.TrimSpace(item.Bucket),
			prefix: normalizeStoragePrefix(item.Prefix),
		}, nil
	default:
		return nil, fmt.Errorf("unsupported provider type: %s", storageType)
	}
}

type mirroredStorageProvider struct {
	main       StorageProvider
	backup     StorageProvider
	backupMode string
}

func (p *mirroredStorageProvider) Put(ctx context.Context, logicalPath string, reader io.Reader, size int64, contentType string) error {
	payload, err := io.ReadAll(reader)
	if err != nil {
		return err
	}
	if size < 0 {
		size = int64(len(payload))
	}

	if err := p.main.Put(ctx, logicalPath, bytes.NewReader(payload), size, contentType); err != nil {
		return err
	}
	if err := p.backup.Put(ctx, logicalPath, bytes.NewReader(payload), size, contentType); err != nil {
		_ = p.main.Delete(ctx, logicalPath)
		return fmt.Errorf("failed to write backup storage: %w", err)
	}
	return nil
}

func (p *mirroredStorageProvider) Get(ctx context.Context, logicalPath string) (io.ReadCloser, ObjectInfo, error) {
	return p.main.Get(ctx, logicalPath)
}

func (p *mirroredStorageProvider) Stat(ctx context.Context, logicalPath string) (ObjectInfo, error) {
	return p.main.Stat(ctx, logicalPath)
}

func (p *mirroredStorageProvider) Delete(ctx context.Context, logicalPath string) error {
	if err := p.main.Delete(ctx, logicalPath); err != nil {
		return err
	}
	if p.backupMode == "mirror" {
		if err := p.backup.Delete(ctx, logicalPath); err != nil {
			return fmt.Errorf("failed to delete backup storage: %w", err)
		}
	}
	return nil
}

func normalizeStoragePrefix(prefix string) string {
	cleaned := strings.TrimSpace(prefix)
	cleaned = strings.Trim(cleaned, "/")
	if cleaned == "" {
		return ""
	}
	return cleaned + "/"
}

func normalizeLogicalUploadPath(logicalPath string) (string, error) {
	trimmed := strings.TrimSpace(strings.TrimPrefix(logicalPath, "/"))
	cleaned := filepath.ToSlash(filepath.Clean(trimmed))
	if cleaned == "." || cleaned == "" || strings.HasPrefix(cleaned, "../") || strings.Contains(cleaned, "/../") {
		return "", errors.New("invalid upload path")
	}
	if !strings.HasPrefix(cleaned, logicalUploadPrefix) {
		return "", errors.New("invalid upload path")
	}
	return cleaned, nil
}

type localStorageProvider struct {
	baseDir string
}

func (p *localStorageProvider) Put(_ context.Context, logicalPath string, reader io.Reader, _ int64, _ string) error {
	fullPath, err := p.resolve(logicalPath)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
		return err
	}
	file, err := os.Create(fullPath)
	if err != nil {
		return err
	}
	defer file.Close()
	_, err = io.Copy(file, reader)
	return err
}

func (p *localStorageProvider) Get(_ context.Context, logicalPath string) (io.ReadCloser, ObjectInfo, error) {
	fullPath, err := p.resolve(logicalPath)
	if err != nil {
		return nil, ObjectInfo{}, err
	}
	stat, err := os.Stat(fullPath)
	if err != nil || stat.IsDir() {
		return nil, ObjectInfo{}, os.ErrNotExist
	}
	file, err := os.Open(fullPath)
	if err != nil {
		return nil, ObjectInfo{}, err
	}
	return file, ObjectInfo{Size: stat.Size(), ModTime: stat.ModTime()}, nil
}

func (p *localStorageProvider) Stat(_ context.Context, logicalPath string) (ObjectInfo, error) {
	fullPath, err := p.resolve(logicalPath)
	if err != nil {
		return ObjectInfo{}, err
	}
	stat, err := os.Stat(fullPath)
	if err != nil || stat.IsDir() {
		return ObjectInfo{}, os.ErrNotExist
	}
	return ObjectInfo{Size: stat.Size(), ModTime: stat.ModTime()}, nil
}

func (p *localStorageProvider) Delete(_ context.Context, logicalPath string) error {
	fullPath, err := p.resolve(logicalPath)
	if err != nil {
		return err
	}
	if err := os.Remove(fullPath); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func (p *localStorageProvider) resolve(logicalPath string) (string, error) {
	cleaned, err := normalizeLogicalUploadPath(logicalPath)
	if err != nil {
		return "", err
	}
	relative := strings.TrimPrefix(cleaned, logicalUploadPrefix)
	baseAbs, err := filepath.Abs(filepath.Clean(p.baseDir))
	if err != nil {
		return "", err
	}
	candidate := filepath.Join(baseAbs, filepath.FromSlash(relative))
	candidateAbs, err := filepath.Abs(candidate)
	if err != nil {
		return "", err
	}
	if candidateAbs != baseAbs && !strings.HasPrefix(candidateAbs, baseAbs+string(os.PathSeparator)) {
		return "", errors.New("invalid upload path")
	}
	return candidateAbs, nil
}

type s3StorageProvider struct {
	client *minio.Client
	bucket string
	prefix string
}

func (p *s3StorageProvider) Put(ctx context.Context, logicalPath string, reader io.Reader, size int64, contentType string) error {
	key, err := p.key(logicalPath)
	if err != nil {
		return err
	}
	_, err = p.client.PutObject(ctx, p.bucket, key, reader, size, minio.PutObjectOptions{
		ContentType: contentType,
	})
	return err
}

func (p *s3StorageProvider) Get(ctx context.Context, logicalPath string) (io.ReadCloser, ObjectInfo, error) {
	key, err := p.key(logicalPath)
	if err != nil {
		return nil, ObjectInfo{}, err
	}
	obj, err := p.client.GetObject(ctx, p.bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, ObjectInfo{}, err
	}
	stat, err := obj.Stat()
	if err != nil {
		_ = obj.Close()
		return nil, ObjectInfo{}, err
	}
	return obj, ObjectInfo{
		Size:        stat.Size,
		ContentType: stat.ContentType,
		ModTime:     stat.LastModified,
	}, nil
}

func (p *s3StorageProvider) Stat(ctx context.Context, logicalPath string) (ObjectInfo, error) {
	key, err := p.key(logicalPath)
	if err != nil {
		return ObjectInfo{}, err
	}
	stat, err := p.client.StatObject(ctx, p.bucket, key, minio.StatObjectOptions{})
	if err != nil {
		return ObjectInfo{}, err
	}
	return ObjectInfo{
		Size:        stat.Size,
		ContentType: stat.ContentType,
		ModTime:     stat.LastModified,
	}, nil
}

func (p *s3StorageProvider) Delete(ctx context.Context, logicalPath string) error {
	key, err := p.key(logicalPath)
	if err != nil {
		return err
	}
	err = p.client.RemoveObject(ctx, p.bucket, key, minio.RemoveObjectOptions{})
	if err != nil && !isS3NoSuchKey(err) {
		return err
	}
	return nil
}

func (p *s3StorageProvider) key(logicalPath string) (string, error) {
	cleaned, err := normalizeLogicalUploadPath(logicalPath)
	if err != nil {
		return "", err
	}
	return p.prefix + cleaned, nil
}

func isS3NoSuchKey(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "no such key") || strings.Contains(msg, "not found")
}
