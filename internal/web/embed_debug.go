//go:build debug
// +build debug

package web

import "github.com/gin-gonic/gin"

type EmbedHandler struct{}

func NewEmbedHandler() (*EmbedHandler, error) {
	return &EmbedHandler{}, nil
}

func (h *EmbedHandler) Serve(c *gin.Context) {
}
