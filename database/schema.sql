CREATE DATABASE IF NOT EXISTS lost_found_hub
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE lost_found_hub;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lost_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  category VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  date_lost DATE NOT NULL,
  location_lost VARCHAR(180) NOT NULL,
  identifying_details TEXT NULL,
  image VARCHAR(500) NULL,
  status ENUM(
    'LOST', 'MATCHED', 'RECOVERY_REQUESTED', 'RECOVERED', 'CLOSED'
  ) NOT NULL DEFAULT 'LOST',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_lost_user (user_id),
  KEY idx_lost_status (status),
  KEY idx_lost_category (category),
  KEY idx_lost_date (date_lost),
  CONSTRAINT fk_lost_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS found_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  category VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  date_found DATE NOT NULL,
  location_found VARCHAR(180) NOT NULL,
  identifying_details TEXT NULL,
  image VARCHAR(500) NULL,
  received_date DATE NOT NULL,
  status ENUM('RECEIVED', 'MATCHED', 'RETURNED', 'CLOSED')
    NOT NULL DEFAULT 'RECEIVED',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_found_admin (admin_id),
  KEY idx_found_status (status),
  KEY idx_found_category (category),
  KEY idx_found_date (date_found),
  CONSTRAINT fk_found_admin
    FOREIGN KEY (admin_id) REFERENCES admin_users(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS matches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lost_item_id BIGINT UNSIGNED NOT NULL,
  found_item_id BIGINT UNSIGNED NOT NULL,
  match_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  match_reason TEXT NOT NULL,
  status ENUM('POSSIBLE', 'CONFIRMED', 'REJECTED')
    NOT NULL DEFAULT 'POSSIBLE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_match_pair (lost_item_id, found_item_id),
  KEY idx_match_status (status),
  CONSTRAINT fk_match_lost
    FOREIGN KEY (lost_item_id) REFERENCES lost_items(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_match_found
    FOREIGN KEY (found_item_id) REFERENCES found_items(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT chk_match_score CHECK (match_score >= 0 AND match_score <= 100)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admin_contact_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  lost_item_id BIGINT UNSIGNED NULL,
  found_item_id BIGINT UNSIGNED NULL,
  message TEXT NOT NULL,
  status ENUM('PENDING', 'IN_REVIEW', 'RESOLVED')
    NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_contact_user (user_id),
  KEY idx_contact_status (status),
  CONSTRAINT fk_contact_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_contact_lost
    FOREIGN KEY (lost_item_id) REFERENCES lost_items(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_contact_found
    FOREIGN KEY (found_item_id) REFERENCES found_items(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS recovery_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lost_item_id BIGINT UNSIGNED NOT NULL,
  found_item_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  admin_id BIGINT UNSIGNED NOT NULL,
  verification_notes TEXT NULL,
  handover_date DATETIME NULL,
  status ENUM('PENDING', 'VERIFIED', 'HANDED_OVER')
    NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_recovery_status (status),
  CONSTRAINT fk_recovery_lost
    FOREIGN KEY (lost_item_id) REFERENCES lost_items(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_recovery_found
    FOREIGN KEY (found_item_id) REFERENCES found_items(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_recovery_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_recovery_admin
    FOREIGN KEY (admin_id) REFERENCES admin_users(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  message VARCHAR(500) NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_user_read (user_id, is_read),
  CONSTRAINT fk_notification_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;