SET @lucifer_has_wallet_purchase_status = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'wallet_purchase_debits'
    AND COLUMN_NAME = 'status'
);
SET @lucifer_ddl = IF(
  @lucifer_has_wallet_purchase_status = 0,
  'ALTER TABLE wallet_purchase_debits ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT ''paid'' AFTER amount_paise',
  'SELECT 1'
);
PREPARE lucifer_stmt FROM @lucifer_ddl;
EXECUTE lucifer_stmt;
DEALLOCATE PREPARE lucifer_stmt;

SET @lucifer_has_wallet_purchase_status_idx = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'wallet_purchase_debits'
    AND INDEX_NAME = 'idx_wallet_purchase_debits_user_status'
);
SET @lucifer_ddl = IF(
  @lucifer_has_wallet_purchase_status_idx = 0,
  'CREATE INDEX idx_wallet_purchase_debits_user_status ON wallet_purchase_debits (user_id, status)',
  'SELECT 1'
);
PREPARE lucifer_stmt FROM @lucifer_ddl;
EXECUTE lucifer_stmt;
DEALLOCATE PREPARE lucifer_stmt;
