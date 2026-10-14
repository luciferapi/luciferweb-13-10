-- Registration and profile flows treat date_of_birth as optional.
-- Existing databases may still have older NOT NULL definitions. Preserve all
-- stored dates while aligning both auth tables with the initial schema.

SET @lucifer_has_pending_registration_dob = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'auth_pending_registrations'
    AND COLUMN_NAME = 'date_of_birth'
);
SET @lucifer_pending_registration_dob_nullable = (
  SELECT IS_NULLABLE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'auth_pending_registrations'
    AND COLUMN_NAME = 'date_of_birth'
  LIMIT 1
);
SET @lucifer_pending_registration_dob_ddl = IF(
  @lucifer_has_pending_registration_dob = 0,
  'ALTER TABLE auth_pending_registrations ADD COLUMN date_of_birth DATE NULL AFTER name',
  IF(
    @lucifer_pending_registration_dob_nullable = 'NO',
    'ALTER TABLE auth_pending_registrations MODIFY COLUMN date_of_birth DATE NULL',
    'SELECT 1'
  )
);
PREPARE lucifer_pending_registration_dob_stmt FROM @lucifer_pending_registration_dob_ddl;
EXECUTE lucifer_pending_registration_dob_stmt;
DEALLOCATE PREPARE lucifer_pending_registration_dob_stmt;

SET @lucifer_has_auth_user_dob = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'auth_users'
    AND COLUMN_NAME = 'date_of_birth'
);
SET @lucifer_auth_user_dob_nullable = (
  SELECT IS_NULLABLE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'auth_users'
    AND COLUMN_NAME = 'date_of_birth'
  LIMIT 1
);
SET @lucifer_auth_user_dob_ddl = IF(
  @lucifer_has_auth_user_dob = 0,
  'ALTER TABLE auth_users ADD COLUMN date_of_birth DATE NULL AFTER password_hash',
  IF(
    @lucifer_auth_user_dob_nullable = 'NO',
    'ALTER TABLE auth_users MODIFY COLUMN date_of_birth DATE NULL',
    'SELECT 1'
  )
);
PREPARE lucifer_auth_user_dob_stmt FROM @lucifer_auth_user_dob_ddl;
EXECUTE lucifer_auth_user_dob_stmt;
DEALLOCATE PREPARE lucifer_auth_user_dob_stmt;
