SET @lucifer_has_api_owner_type = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'api_endpoints'
    AND COLUMN_NAME = 'owner_type'
);
SET @lucifer_api_owner_type_ddl = IF(
  @lucifer_has_api_owner_type = 0,
  'ALTER TABLE api_endpoints ADD COLUMN owner_type VARCHAR(128) NOT NULL DEFAULT '''' AFTER category',
  'SELECT 1'
);
PREPARE lucifer_api_owner_type_stmt FROM @lucifer_api_owner_type_ddl;
EXECUTE lucifer_api_owner_type_stmt;
DEALLOCATE PREPARE lucifer_api_owner_type_stmt;

SET @lucifer_has_api_price_paise = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'api_endpoints'
    AND COLUMN_NAME = 'price_paise'
);
SET @lucifer_api_price_paise_ddl = IF(
  @lucifer_has_api_price_paise = 0,
  'ALTER TABLE api_endpoints ADD COLUMN price_paise BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER is_enabled',
  'SELECT 1'
);
PREPARE lucifer_api_price_paise_stmt FROM @lucifer_api_price_paise_ddl;
EXECUTE lucifer_api_price_paise_stmt;
DEALLOCATE PREPARE lucifer_api_price_paise_stmt;
