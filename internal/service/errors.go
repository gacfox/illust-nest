package service

import "errors"

type ValidationError struct {
	Message string `json:"message"`
	Code    int    `json:"code"`
}

func (e *ValidationError) Error() string {
	if e == nil {
		return ""
	}
	return e.Message
}

var (
	ErrWorkNotFound              = errors.New("work not found")
	ErrImageNotFound             = errors.New("image not found")
	ErrAtLeastOneImageRequired   = errors.New("at least one image is required")
	ErrWorkMustHaveAtLeastOne    = errors.New("work must have at least one image")
	ErrCannotDeleteLastImage     = errors.New("cannot delete the last image")
	ErrAIMetadataRequiredFields  = errors.New("AI metadata checkpoint and prompt are required")
	ErrEXIFUnsupportedSourceType = errors.New("EXIF only supports JPG/TIFF source images")
)
