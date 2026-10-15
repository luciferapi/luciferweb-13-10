-- Add owner review details to paid project requests without changing payment state.
SET @has_review_status = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_requests' AND COLUMN_NAME = 'review_status'
);
SET @sql = IF(@has_review_status = 0,
  'ALTER TABLE project_requests ADD COLUMN review_status VARCHAR(24) NOT NULL DEFAULT ''pending'' AFTER status',
  'SELECT 1'
);
PREPARE project_request_review_stmt FROM @sql;
EXECUTE project_request_review_stmt;
DEALLOCATE PREPARE project_request_review_stmt;

SET @has_owner_message = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_requests' AND COLUMN_NAME = 'owner_message'
);
SET @sql = IF(@has_owner_message = 0,
  'ALTER TABLE project_requests ADD COLUMN owner_message TEXT NULL AFTER review_status',
  'SELECT 1'
);
PREPARE project_request_message_stmt FROM @sql;
EXECUTE project_request_message_stmt;
DEALLOCATE PREPARE project_request_message_stmt;

SET @has_reviewed_by = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_requests' AND COLUMN_NAME = 'reviewed_by'
);
SET @sql = IF(@has_reviewed_by = 0,
  'ALTER TABLE project_requests ADD COLUMN reviewed_by CHAR(36) NULL AFTER owner_message',
  'SELECT 1'
);
PREPARE project_request_reviewer_stmt FROM @sql;
EXECUTE project_request_reviewer_stmt;
DEALLOCATE PREPARE project_request_reviewer_stmt;

SET @has_reviewed_at = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_requests' AND COLUMN_NAME = 'reviewed_at'
);
SET @sql = IF(@has_reviewed_at = 0,
  'ALTER TABLE project_requests ADD COLUMN reviewed_at DATETIME(3) NULL AFTER reviewed_by',
  'SELECT 1'
);
PREPARE project_request_reviewed_at_stmt FROM @sql;
EXECUTE project_request_reviewed_at_stmt;
DEALLOCATE PREPARE project_request_reviewed_at_stmt;
