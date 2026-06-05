-- Round 22-7-5K-6A: add JSON-shape preservation storage for home-video.
-- This migration only adds home_video.raw_json. It does not backfill data,
-- change scalar fields, write media_files, write uploads, or switch write mode.

SET @home_video_raw_json_ddl = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE home_video ADD COLUMN raw_json JSON NULL',
    'SELECT ''home_video.raw_json already exists'' AS migration_note'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'home_video'
    AND COLUMN_NAME = 'raw_json'
);

PREPARE home_video_raw_json_stmt FROM @home_video_raw_json_ddl;
EXECUTE home_video_raw_json_stmt;
DEALLOCATE PREPARE home_video_raw_json_stmt;
