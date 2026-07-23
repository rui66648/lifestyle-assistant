-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  phone       TEXT UNIQUE,
  email       TEXT UNIQUE,
  password    TEXT NOT NULL,        -- PBKDF2 哈希
  salt        TEXT NOT NULL,        -- 每用户独立盐值
  nickname    TEXT DEFAULT '',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

-- 刷新令牌表
CREATE TABLE IF NOT EXISTS refresh_tokens (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  device_id   TEXT,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- 用户数据同步表
CREATE TABLE IF NOT EXISTS user_data (
  user_id     TEXT NOT NULL,
  data_key    TEXT NOT NULL,
  data_value  TEXT NOT NULL,        -- JSON 字符串
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, data_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_data_user ON user_data(user_id);
