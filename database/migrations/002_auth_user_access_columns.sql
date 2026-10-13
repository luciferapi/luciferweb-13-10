SET @lucifer_has_is_blocked = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'auth_users'
    AND COLUMN_NAME = 'is_blocked'
);
SET @lucifer_ddl = IF(
  @lucifer_has_is_blocked = 0,
  'ALTER TABLE auth_users ADD COLUMN is_blocked BOOLEAN NOT NULL DEFAULT FALSE',
  'SELECT 1'
);
PREPARE lucifer_stmt FROM @lucifer_ddl;
EXECUTE lucifer_stmt;
DEALLOCATE PREPARE lucifer_stmt;

CREATE TABLE IF NOT EXISTS owner_admins (
  user_id CHAR(36) PRIMARY KEY,
  added_by CHAR(36) NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'admin',
  allowed_modules JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY owner_admins_added_by_idx (added_by),
  CONSTRAINT owner_admins_user_fk FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  CONSTRAINT owner_admins_added_by_fk FOREIGN KEY (added_by) REFERENCES auth_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @lucifer_has_blocked_at = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'auth_users'
    AND COLUMN_NAME = 'blocked_at'
);
SET @lucifer_ddl = IF(
  @lucifer_has_blocked_at = 0,
  'ALTER TABLE auth_users ADD COLUMN blocked_at DATETIME(3) NULL',
  'SELECT 1'
);
PREPARE lucifer_stmt FROM @lucifer_ddl;
EXECUTE lucifer_stmt;
DEALLOCATE PREPARE lucifer_stmt;
