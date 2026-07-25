.PHONY: cf-pages clean

ARCHIVE_NAME ?= usage-panel-cf-pages.zip

cf-pages: clean
	bash scripts/build-cf-pages.sh
	mkdir -p output
	cd dist && zip -r ../output/$(ARCHIVE_NAME) .

# 清理 dist 目录
clean:
	rm -rf dist output

# 本地预览：启动 wrangler dev 本地开发服务器
preview:
	npm run dev

# 打包输出到 dist 目录（使用 wrangler deploy --dry-run 生成构建产物）
dist: clean
	npx wrangler deploy --dry-run --outdir=dist
	@echo "打包完成: dist/"

# 发布到 Cloudflare Workers
deploy: dist
	npm run deploy
	@echo "发布完成"
