-- ============================================================
-- 养生助手 MySQL 数据库初始化脚本
-- 使用：在阿里云 RDS MySQL 控制台执行（或通过命令行）
-- ============================================================

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS lifestyle_assistant DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lifestyle_assistant;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id          VARCHAR(36) PRIMARY KEY,
  phone       VARCHAR(11) UNIQUE NOT NULL,
  email       VARCHAR(255) UNIQUE,
  password    VARCHAR(128) NOT NULL,
  salt        VARCHAR(64) NOT NULL,
  nickname    VARCHAR(20) DEFAULT '',
  created_at  BIGINT NOT NULL,
  updated_at  BIGINT NOT NULL,
  INDEX idx_users_phone (phone),
  INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 刷新令牌表
CREATE TABLE IF NOT EXISTS refresh_tokens (
  token       VARCHAR(64) PRIMARY KEY,
  user_id     VARCHAR(36) NOT NULL,
  device_id   VARCHAR(64),
  expires_at  BIGINT NOT NULL,
  created_at  BIGINT NOT NULL,
  INDEX idx_refresh_tokens_user (user_id),
  INDEX idx_refresh_tokens_expires (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户数据同步表
CREATE TABLE IF NOT EXISTS user_data (
  user_id     VARCHAR(36) NOT NULL,
  data_key    VARCHAR(64) NOT NULL,
  data_value  TEXT NOT NULL,
  updated_at  BIGINT NOT NULL,
  PRIMARY KEY (user_id, data_key),
  INDEX idx_user_data_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 清理过期令牌的事件（每天凌晨执行）
-- 需要先开启事件调度器：SET GLOBAL event_scheduler = ON;
DELIMITER //
CREATE EVENT IF NOT EXISTS cleanup_expired_tokens
ON SCHEDULE EVERY 1 DAY STARTS '2026-01-01 00:00:00'
DO
BEGIN
  DELETE FROM refresh_tokens WHERE expires_at < UNIX_TIMESTAMP() * 1000;
END //
DELIMITER ;
