-- Add auth_user_id for databases created before email-verification registrations
-- began assigning a stable auth_users.id before the OTP is verified.
-- Existing pending rows are assigned UUIDs so they remain verifiable.

SET @lucifer_has_auth_pending_user_id = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'auth_pending_registrations'
    AND COLUMN_NAME = 'auth_user_id'
);
SET @lucifer_auth_pending_user_id_ddl = IF(
  @lucifer_has_auth_pending_user_id = 0,
  'ALTER TABLE auth_pending_registrations ADD COLUMN auth_user_id CHAR(36) NULL AFTER email',
  'SELECT 1'
);
PREPARE lucifer_auth_pending_user_id_stmt FROM @lucifer_auth_pending_user_id_ddl;
EXECUTE lucifer_auth_pending_user_id_stmt;
DEALLOCATE PREPARE lucifer_auth_pending_user_id_stmt;

UPDATE auth_pending_registrations
SET auth_user_id = UUID()
WHERE auth_user_id IS NULL OR auth_user_id = '';

SET @lucifer_has_auth_pending_user_id_unique = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'auth_pending_registrations'
    AND COLUMN_NAME = 'auth_user_id'
    AND NON_UNIQUE = 0
);
SET @lucifer_auth_pending_user_id_index_ddl = IF(
  @lucifer_has_auth_pending_user_id_unique = 0,
  'ALTER TABLE auth_pending_registrations ADD UNIQUE KEY auth_pending_registrations_auth_user_id_uq (auth_user_id)',
  'SELECT 1'
);
PREPARE lucifer_auth_pending_user_id_index_stmt FROM @lucifer_auth_pending_user_id_index_ddl;
EXECUTE lucifer_auth_pending_user_id_index_stmt;
DEALLOCATE PREPARE lucifer_auth_pending_user_id_index_stmt;

ALTER TABLE auth_pending_registrations
  MODIFY COLUMN auth_user_id CHAR(36) NOT NULL;
