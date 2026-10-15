CREATE TABLE IF NOT EXISTS auth_users (
  id CHAR(36) PRIMARY KEY,
  public_uid VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(320) UNIQUE,
  password_hash VARCHAR(255) NULL,
  date_of_birth DATE NULL,
  telegram_username VARCHAR(64) NULL,
  x_username VARCHAR(64) NULL,
  name_edit_used BOOLEAN NOT NULL DEFAULT FALSE,
  date_of_birth_edit_used BOOLEAN NOT NULL DEFAULT FALSE,
  signup_ip_hash CHAR(64) NULL UNIQUE,
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  blocked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_identities (
  provider VARCHAR(32) NOT NULL,
  provider_user_id VARCHAR(255) NOT NULL,
  user_id CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (provider, provider_user_id),
  KEY auth_identities_user_id_idx (user_id),
  CONSTRAINT auth_identities_user_fk FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  auth_method VARCHAR(32) NOT NULL DEFAULT 'password',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY auth_sessions_user_id_idx (user_id),
  KEY auth_sessions_expires_at_idx (expires_at),
  CONSTRAINT auth_sessions_user_fk FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_owner_login_otps (
  email VARCHAR(320) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  otp_hash CHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  resend_after DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  KEY auth_owner_login_otps_expires_at_idx (expires_at),
  CONSTRAINT auth_owner_login_otps_user_fk FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_pending_registrations (
  email VARCHAR(320) PRIMARY KEY,
  auth_user_id CHAR(36) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  date_of_birth DATE NULL,
  signup_ip_hash CHAR(64) NULL,
  referral_code VARCHAR(32) NULL,
  otp_hash CHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  resend_after DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  registration_expires_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY auth_pending_registrations_expires_at_idx (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_password_resets (
  token_hash CHAR(64) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  claim_token CHAR(36) NULL,
  claim_expires_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY auth_password_resets_user_id_idx (user_id),
  KEY auth_password_resets_expires_at_idx (expires_at),
  CONSTRAINT auth_password_resets_user_fk FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
  project_number BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  id VARCHAR(128) PRIMARY KEY,
  code VARCHAR(128) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(32) NOT NULL,
  image_url TEXT NOT NULL,
  demo_video TEXT NULL,
  technologies JSON NOT NULL,
  role VARCHAR(255) NOT NULL,
  live_demo_url TEXT NOT NULL,
  source_code_url TEXT NOT NULL,
  price VARCHAR(64) NOT NULL,
  is_published BOOLEAN NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS api_endpoints (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  endpoint_path VARCHAR(1024) NOT NULL,
  note TEXT NOT NULL,
  category VARCHAR(128) NOT NULL,
  owner_type VARCHAR(128) NOT NULL DEFAULT '',
  image_url TEXT NOT NULL,
  demo_video TEXT NULL,
  link_url TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  price_paise BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY api_endpoints_enabled_category_name_idx (is_enabled, category, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_purchases (
  payment_id VARCHAR(255) NULL UNIQUE,
  order_id VARCHAR(255) NOT NULL UNIQUE,
  user_id CHAR(36) NOT NULL,
  project_code VARCHAR(128) NOT NULL,
  project_title VARCHAR(255) NOT NULL,
  amount_paise BIGINT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  purchased_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY project_purchases_user_date_idx (user_id, purchased_at),
  CONSTRAINT project_purchases_user_fk FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_ref CHAR(36) NOT NULL UNIQUE,
  user_id CHAR(36) NOT NULL,
  project_name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  contact_email VARCHAR(320) NULL,
  whatsapp_number VARCHAR(64) NULL,
  telegram_id VARCHAR(128) NULL,
  preferred_language VARCHAR(128) NULL,
  desired_duration VARCHAR(128) NULL,
  order_id VARCHAR(255) NOT NULL UNIQUE,
  payment_id VARCHAR(255) NULL UNIQUE,
  payment_amount_paise INT UNSIGNED NOT NULL,
  payment_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  status VARCHAR(32) NOT NULL DEFAULT 'awaiting_payment',
  review_status VARCHAR(24) NOT NULL DEFAULT 'pending',
  owner_message TEXT NULL,
  reviewed_by CHAR(36) NULL,
  reviewed_at DATETIME(3) NULL,
  notification_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY project_requests_user_date_idx (user_id, created_at),
  CONSTRAINT project_requests_user_fk FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wallet_deposits (
  deposit_id VARCHAR(255) NOT NULL UNIQUE,
  payment_id VARCHAR(255) NULL UNIQUE,
  order_id VARCHAR(255) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  amount_paise BIGINT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  payment_details JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  paid_at DATETIME(3) NULL,
  KEY wallet_deposits_user_date_idx (user_id, created_at),
  CONSTRAINT wallet_deposits_user_fk FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wallet_withdrawal_requests (
  request_id CHAR(36) PRIMARY KEY,
  withdrawal_id VARCHAR(255) NOT NULL UNIQUE,
  user_id CHAR(36) NOT NULL,
  amount_paise BIGINT UNSIGNED NOT NULL,
  method_type VARCHAR(16) NOT NULL,
  payout_destination VARCHAR(512) NOT NULL,
  request_date DATE NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  owner_response VARCHAR(1000) NULL,
  payment_reference VARCHAR(120) NULL,
  owner_note VARCHAR(1000) NULL,
  processed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY wallet_withdrawals_user_date_idx (user_id, request_date),
  KEY wallet_withdrawals_status_user_idx (status, user_id),
  CONSTRAINT wallet_withdrawals_user_fk FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_withdrawal_methods (
  user_id CHAR(36) PRIMARY KEY,
  method_type VARCHAR(16) NOT NULL,
  encrypted_payload TEXT NOT NULL,
  iv VARCHAR(64) NOT NULL,
  auth_tag VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT user_withdrawal_methods_user_fk FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS referral_profiles (
  user_id CHAR(36) PRIMARY KEY,
  referral_code VARCHAR(32) NOT NULL UNIQUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT referral_profiles_user_fk FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS referrals (
  id CHAR(36) PRIMARY KEY,
  referrer_id CHAR(36) NOT NULL,
  referee_id CHAR(36) NOT NULL UNIQUE,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  status_reason TEXT NULL DEFAULT 'Awaiting manual review',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY referrals_referrer_created_idx (referrer_id, created_at),
  KEY referrals_status_created_idx (status, created_at),
  CONSTRAINT referrals_referrer_fk FOREIGN KEY (referrer_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  CONSTRAINT referrals_referee_fk FOREIGN KEY (referee_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS referral_program_settings (
  program_id SMALLINT UNSIGNED PRIMARY KEY,
  referrer_reward_type VARCHAR(16) NOT NULL DEFAULT 'fixed',
  referrer_reward_amount DECIMAL(10,2) NOT NULL DEFAULT 10.00,
  referrer_reward_currency CHAR(3) NOT NULL DEFAULT 'INR',
  referee_reward_type VARCHAR(16) NOT NULL DEFAULT 'fixed',
  referee_reward_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  referee_reward_currency CHAR(3) NOT NULL DEFAULT 'INR',
  min_purchase_amount DECIMAL(10,2) NULL,
  valid_until DATETIME(3) NULL,
  max_referrals INT UNSIGNED NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO referral_program_settings (program_id) VALUES (1);

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

CREATE TABLE IF NOT EXISTS owner_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_user_id CHAR(36) NULL,
  action VARCHAR(128) NOT NULL,
  subject_user_id CHAR(36) NULL,
  details JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY owner_audit_logs_created_idx (created_at),
  KEY owner_audit_logs_actor_created_idx (actor_user_id, created_at),
  CONSTRAINT owner_audit_logs_actor_fk FOREIGN KEY (actor_user_id) REFERENCES auth_users(id) ON DELETE SET NULL,
  CONSTRAINT owner_audit_logs_subject_fk FOREIGN KEY (subject_user_id) REFERENCES auth_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS owner_wallet_adjustments (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  actor_user_id CHAR(36) NULL,
  amount_paise BIGINT NOT NULL,
  reason VARCHAR(500) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY owner_wallet_adjustments_user_created_idx (user_id, created_at),
  CONSTRAINT owner_wallet_adjustments_user_fk FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  CONSTRAINT owner_wallet_adjustments_actor_fk FOREIGN KEY (actor_user_id) REFERENCES auth_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS api_endpoint_purchases (
  order_id VARCHAR(255) PRIMARY KEY,
  payment_id VARCHAR(255) NULL UNIQUE,
  user_id CHAR(36) NOT NULL,
  endpoint_id VARCHAR(128) NOT NULL,
  endpoint_name VARCHAR(255) NOT NULL,
  amount_paise BIGINT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  purchased_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY api_endpoint_purchases_user_date_idx (user_id, purchased_at),
  KEY api_endpoint_purchases_user_endpoint_paid_idx (user_id, endpoint_id, status),
  CONSTRAINT api_endpoint_purchases_user_fk FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS support_tickets (
  id CHAR(36) PRIMARY KEY,
  ticket_code VARCHAR(64) NOT NULL UNIQUE,
  user_id CHAR(36) NOT NULL,
  issue_type VARCHAR(32) NOT NULL,
  order_id VARCHAR(255) NULL,
  initial_message TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  escalated_at DATETIME(3) NULL,
  escalated_by CHAR(36) NULL,
  escalation_note VARCHAR(1000) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY support_tickets_user_created_idx (user_id, created_at),
  KEY support_tickets_status_updated_idx (status, updated_at),
  KEY support_tickets_escalated_updated_idx (escalated_at, updated_at),
  CONSTRAINT support_tickets_user_fk FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  CONSTRAINT support_tickets_escalated_by_fk FOREIGN KEY (escalated_by) REFERENCES auth_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id CHAR(36) PRIMARY KEY,
  ticket_id CHAR(36) NOT NULL,
  author_user_id CHAR(36) NULL,
  author_role VARCHAR(16) NOT NULL,
  author_name VARCHAR(100) NOT NULL,
  author_email VARCHAR(320) NULL,
  body TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY support_ticket_messages_ticket_created_idx (ticket_id, created_at),
  CONSTRAINT support_ticket_messages_ticket_fk FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  CONSTRAINT support_ticket_messages_author_fk FOREIGN KEY (author_user_id) REFERENCES auth_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS owner_live_banners (
  id CHAR(36) PRIMARY KEY,
  message VARCHAR(240) NOT NULL,
  link_url VARCHAR(500) NULL,
  image_url TEXT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY owner_live_banners_active_order_idx (is_enabled, sort_order, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_maintenance_pages (
  id CHAR(36) PRIMARY KEY,
  path VARCHAR(255) NOT NULL UNIQUE,
  title VARCHAR(120) NOT NULL,
  message VARCHAR(500) NOT NULL,
  image_url VARCHAR(2000) NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY site_maintenance_pages_active_order_idx (is_enabled, sort_order, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS api_rate_limit_buckets (
  bucket_key CHAR(64) PRIMARY KEY,
  tokens DECIMAL(12,6) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  KEY api_rate_limit_buckets_expires_at_idx (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
