CREATE TABLE IF NOT EXISTS wallet_purchase_debits (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_key VARCHAR(160) NOT NULL,
  user_id VARCHAR(191) NOT NULL,
  amount_paise BIGINT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_wallet_purchase_debits_key (purchase_key),
  KEY idx_wallet_purchase_debits_user (user_id, created_at),
  CONSTRAINT fk_wallet_purchase_debits_user FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
