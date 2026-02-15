# Illust Nest

超轻量级、自托管的插画和照片图库管理系统，适合部署在树莓派、NAS或云主机上。

![截图](doc/1.webp)

## 核心特性

- 作品管理：图片上传、编辑作品信息、类似Pixiv的图片预览、维护标签与评分、重复图片检测、数据统计
- 作品检索：支持按关键字、标签、评分筛选，按时间或评分排序
- 作品集管理：将作品整合为作品集维度管理
- 标签管理：支持标签管理和为作品附加标签
- 公开访问：
  - 公开作品列表与详情接口
  - 公开图片直链（用于外部页面挂载）
- 作品导出：
  - 打包下载全部图片（ZIP）和Excel索引文件
- 响应式前端：支持 PC / iPad / 手机
- 支持浅色 / 暗色或跟随系统主题切换

## 技术栈

- Backend: Gin, GORM, SQLite
- Frontend: React, Vite, Tailwind CSS, shadcn/ui

## 快速开始（开发）

### 1) 启动前端

```bash
cd frontend && npm install && npm run dev
```

默认前端地址为`http://localhost:5173`（通过Vite的devServer反向代理`/api`到后端）。

### 2) 启动服务端

```bash
go build -o ./bin/main ./cmd/server/ && ./bin/main
```

默认服务端地址为`http://localhost:8080`。

## 构建与部署

### 1) 构建前端

```bash
cd frontend && npm install && npm run build
```

产物位于`frontend/dist`文件夹中。

### 2) 启动服务端

```bash
GIN_MODE=release go build -o ./bin/main ./cmd/server/ && ./bin/main
```

部署模式下，服务端会直接提供前端静态资源，并自动处理SPA路由回退，访问`8080`即可打开页面。

## 配置说明

配置文件根据环境变量设置加载，`GIN_MODE=release`时默认加载`config/config.prod.yaml`，否则默认加载`config/config.dev.yaml`。此外也可通过环境变量`CONFIG_FILE`指定自定义配置文件路径。

### 配置项示例

```yaml
server:
  port: 8080 # 启动端口
  mode: debug # 设置GIN的运行模式，一般使用release或debug

database:
  driver: sqlite # 固定值，目前仅支持sqlite数据库
  path: ./data/illust-nest.db # 创建数据库文件的路径

storage:
  upload_base_dir: ./data/uploads # 图片的存储路径

web:
  static_dir: ./frontend/dist # 静态资源文件夹的路径，部署时需要指定为Vite编译产物的目录
```

## 公开（匿名）访问接口

作品可以标记为“公开”，公开的作品可通过公开接口跳过鉴权匿名访问，用于嵌入博客或外部平台。

- 作品列表：`GET /api/public/works`
- 作品详情：`GET /api/public/works/:id`
- 作品原图：`GET /api/public/images/originals/*filepath`
- 作品缩略图：`GET /api/public/images/thumbnails/*filepath`

## 未来计划

- [ ] 支持S3、WebDAV作为存储后端
- [ ] 支持多存储后端，形成主存储后端/备份存储后端模式
- [ ] 更多图片格式支持和图片格式转换、下载功能
- [ ] 支持读取和编辑图片本身的EXIF信息
- [ ] 提供API接口，便于和爬虫、自动化AI等集成
