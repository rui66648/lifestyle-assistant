# D1 数据库迁移

## 创建数据库

```bash
npx wrangler d1 create lifestyle-assistant
```

将返回的 database_id 填入 `wrangler.toml`。

## 执行迁移

```bash
# 本地开发
npx wrangler d1 migrations apply lifestyle-assistant --local

# 生产环境
npx wrangler d1 migrations apply lifestyle-assistant --remote
```

## 迁移文件命名规则

- `0001_init.sql` — 初始建表
- `0002_xxx.sql` — 后续变更
- 文件名格式：`{序号}_{描述}.sql`，序号递增
