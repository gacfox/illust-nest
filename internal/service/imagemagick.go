package service

import (
	"errors"
	"fmt"
	"os/exec"
	"strings"
)

const (
	ImageMagickVersionV6 = "v6"
	ImageMagickVersionV7 = "v7"
)

func normalizeImageMagickVersion(version string) string {
	cleaned := strings.ToLower(strings.TrimSpace(version))
	if cleaned == "" {
		return ImageMagickVersionV7
	}
	if cleaned != ImageMagickVersionV6 && cleaned != ImageMagickVersionV7 {
		return ImageMagickVersionV7
	}
	return cleaned
}

func resolveImageMagickCommand(version string) (string, error) {
	switch normalizeImageMagickVersion(version) {
	case ImageMagickVersionV6:
		return "convert", nil
	case ImageMagickVersionV7:
		return "magick", nil
	default:
		return "", errors.New("invalid ImageMagick version")
	}
}

func testImageMagickCommand(version string) (string, error) {
	cmdName, err := resolveImageMagickCommand(version)
	if err != nil {
		return "", err
	}
	if _, err := exec.LookPath(cmdName); err != nil {
		return "", fmt.Errorf("command not found: %s", cmdName)
	}

	out, err := exec.Command(cmdName, "-version").CombinedOutput()
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = err.Error()
		}
		return "", fmt.Errorf("failed to run %s -version: %s", cmdName, msg)
	}

	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	if len(lines) == 0 || strings.TrimSpace(lines[0]) == "" {
		return cmdName, nil
	}
	return strings.TrimSpace(lines[0]), nil
}

func runImageMagick(version string, args ...string) error {
	cmdName, err := resolveImageMagickCommand(version)
	if err != nil {
		return err
	}
	if _, err := exec.LookPath(cmdName); err != nil {
		return fmt.Errorf("command not found: %s", cmdName)
	}

	out, err := exec.Command(cmdName, args...).CombinedOutput()
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = err.Error()
		}
		return fmt.Errorf("failed to run %s: %s", cmdName, msg)
	}
	return nil
}
