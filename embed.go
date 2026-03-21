//go:build !debug

package illust_nest

import "embed"

//go:embed frontend/dist
var FrontendFiles embed.FS
