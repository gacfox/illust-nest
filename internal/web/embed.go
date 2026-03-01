//go:build !debug
// +build !debug

package web

import (
	"embed"
	"io"
	"io/fs"
	"net/http"
	"path"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

//go:embed dist
var FrontendFiles embed.FS

type EmbedHandler struct{}

func NewEmbedHandler() (*EmbedHandler, error) {
	return &EmbedHandler{}, nil
}

func (h *EmbedHandler) Serve(c *gin.Context) {
	reqPath := strings.TrimPrefix(c.Request.URL.Path, "/")
	reqPath = path.Clean(reqPath)
	if reqPath == "." || reqPath == "" {
		reqPath = "index.html"
	}

	sub, err := fs.Sub(FrontendFiles, "dist")
	if err != nil {
		c.String(http.StatusInternalServerError, "failed to access embedded files")
		return
	}

	file, err := sub.Open(reqPath)
	if err != nil || isPathDir(sub, reqPath) {
		reqPath = "index.html"
		file, err = sub.Open(reqPath)
		if err != nil {
			c.String(http.StatusNotFound, "frontend index not found")
			return
		}
	}
	defer file.Close()

	content, err := io.ReadAll(file)
	if err != nil {
		c.String(http.StatusInternalServerError, "failed to read file")
		return
	}

	contentType := getContentType(reqPath)
	c.Header("Content-Type", contentType)
	c.Header("Cache-Control", "max-age=31536000")
	c.Status(http.StatusOK)
	c.Writer.Write(content)
}

func isPathDir(sub fs.FS, reqPath string) bool {
	info, err := fs.Stat(sub, reqPath)
	return err != nil || info.IsDir()
}

func getContentType(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".html":
		return "text/html"
	case ".js":
		return "application/javascript"
	case ".css":
		return "text/css"
	case ".json":
		return "application/json"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".svg":
		return "image/svg+xml"
	case ".ico":
		return "image/x-icon"
	case ".woff":
		return "font/woff"
	case ".woff2":
		return "font/woff2"
	case ".ttf":
		return "font/ttf"
	case ".eot":
		return "application/vnd.ms-fontobject"
	default:
		return "application/octet-stream"
	}
}
