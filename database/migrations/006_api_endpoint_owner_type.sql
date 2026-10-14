SET @lucifer_has_api_owner_type = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'api_endpoints'
    AND COLUMN_NAME = 'owner_type'
);
SET @lucifer_ddl = IF(
  @lucifer_has_api_owner_type = 0,
  'ALTER TABLE api_endpoints ADD COLUMN owner_type VARCHAR(128) NOT NULL DEFAULT '''' AFTER category',
  'SELECT 1'
);
PREPARE lucifer_stmt FROM @lucifer_ddl;
EXECUTE lucifer_stmt;
DEALLOCATE PREPARE lucifer_stmt;
