SET @lucifer_has_owner_response = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'wallet_withdrawal_requests'
    AND COLUMN_NAME = 'owner_response'
);
SET @lucifer_ddl = IF(
  @lucifer_has_owner_response = 0,
  'ALTER TABLE wallet_withdrawal_requests ADD COLUMN owner_response VARCHAR(1000) NULL',
  'SELECT 1'
);
PREPARE lucifer_stmt FROM @lucifer_ddl;
EXECUTE lucifer_stmt;
DEALLOCATE PREPARE lucifer_stmt;

SET @lucifer_has_payment_reference = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'wallet_withdrawal_requests'
    AND COLUMN_NAME = 'payment_reference'
);
SET @lucifer_ddl = IF(
  @lucifer_has_payment_reference = 0,
  'ALTER TABLE wallet_withdrawal_requests ADD COLUMN payment_reference VARCHAR(120) NULL',
  'SELECT 1'
);
PREPARE lucifer_stmt FROM @lucifer_ddl;
EXECUTE lucifer_stmt;
DEALLOCATE PREPARE lucifer_stmt;

SET @lucifer_has_owner_note = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'wallet_withdrawal_requests'
    AND COLUMN_NAME = 'owner_note'
);
SET @lucifer_ddl = IF(
  @lucifer_has_owner_note = 0,
  'ALTER TABLE wallet_withdrawal_requests ADD COLUMN owner_note VARCHAR(1000) NULL',
  'SELECT 1'
);
PREPARE lucifer_stmt FROM @lucifer_ddl;
EXECUTE lucifer_stmt;
DEALLOCATE PREPARE lucifer_stmt;

SET @lucifer_has_processed_at = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'wallet_withdrawal_requests'
    AND COLUMN_NAME = 'processed_at'
);
SET @lucifer_ddl = IF(
  @lucifer_has_processed_at = 0,
  'ALTER TABLE wallet_withdrawal_requests ADD COLUMN processed_at DATETIME(3) NULL',
  'SELECT 1'
);
PREPARE lucifer_stmt FROM @lucifer_ddl;
EXECUTE lucifer_stmt;
DEALLOCATE PREPARE lucifer_stmt;
