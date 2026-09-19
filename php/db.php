<?php
// The database, and the tables it needs. IONOS gives you a MySQL database and phpMyAdmin; nothing
// here asks you to use phpMyAdmin, because the tables are created on the first request that needs
// them and then never touched again. `schema_version` is what makes that cheap: once the stored
// version matches, no DDL runs at all.
const POTATOMAN_SCHEMA = 3;

function potatoman_db(array $config): PDO {
 static $pdo = null;
 if ($pdo !== null) return $pdo;
 $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $config['db_host'], $config['db_name']);
 $pdo = new PDO($dsn, $config['db_user'], $config['db_pass'], [
  PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  PDO::ATTR_EMULATE_PREPARES => false,
 ]);
 potatoman_install($pdo);
 return $pdo;
}

// Every table in one place, in the order the foreign keys need. The columns and their names match
// the Node service exactly, so a site can be moved between the two without touching the game.
function potatoman_install(PDO $pdo): void {
 $have = 0;
 try {
  $row = $pdo->query("SELECT value FROM potatoman_meta WHERE name='schema'")->fetch();
  $have = $row ? (int)$row['value'] : 0;
 } catch (PDOException $e) { $have = 0; }
 if ($have >= POTATOMAN_SCHEMA) return;

 $tables = [
  "CREATE TABLE IF NOT EXISTS potatoman_meta (name VARCHAR(32) NOT NULL PRIMARY KEY, value VARCHAR(64) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
  "CREATE TABLE IF NOT EXISTS profiles (
    id CHAR(36) NOT NULL PRIMARY KEY,
    token VARCHAR(80) NOT NULL,
    name VARCHAR(24) NOT NULL,
    motto VARCHAR(60) NOT NULL DEFAULT '',
    created BIGINT NOT NULL,
    email VARCHAR(254) NULL,
    email_key VARCHAR(254) NULL,
    verified TINYINT NOT NULL DEFAULT 0,
    verify_token VARCHAR(80) NULL,
    verify_sent BIGINT NOT NULL DEFAULT 0,
    UNIQUE KEY idx_profiles_email (email_key),
    KEY idx_profiles_token (token),
    KEY idx_profiles_verify (verify_token)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
  "CREATE TABLE IF NOT EXISTS runs (
    id CHAR(36) NOT NULL PRIMARY KEY,
    profile CHAR(36) NOT NULL,
    started BIGINT NOT NULL,
    finished BIGINT NULL,
    start_level INT NOT NULL,
    round_seconds INT NOT NULL,
    mode VARCHAR(8) NOT NULL,
    score INT NOT NULL DEFAULT 0,
    rounds INT NOT NULL DEFAULT 0,
    wins INT NOT NULL DEFAULT 0,
    knockouts INT NOT NULL DEFAULT 0,
    complete TINYINT NOT NULL DEFAULT 0,
    points INT NOT NULL DEFAULT 0,
    played_ms BIGINT NOT NULL DEFAULT 0,
    revision INT NOT NULL DEFAULT 0,
    KEY idx_runs_profile (profile),
    KEY idx_runs_complete_score (complete, score),
    CONSTRAINT fk_runs_profile FOREIGN KEY (profile) REFERENCES profiles(id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
  "CREATE TABLE IF NOT EXISTS race_times (
    run CHAR(36) NOT NULL,
    level INT NOT NULL,
    milliseconds INT NOT NULL,
    PRIMARY KEY (run, level),
    KEY idx_race_times_level_time (level, milliseconds),
    CONSTRAINT fk_race_times_run FOREIGN KEY (run) REFERENCES runs(id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
  "CREATE TABLE IF NOT EXISTS rooms (
    code CHAR(10) NOT NULL PRIMARY KEY,
    created BIGINT NOT NULL,
    updated BIGINT NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'lobby',
    snapshot MEDIUMTEXT NULL,
    seq BIGINT NOT NULL DEFAULT 0,
    KEY idx_rooms_updated (updated)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
  "CREATE TABLE IF NOT EXISTS members (
    room CHAR(10) NOT NULL,
    slot INT NOT NULL,
    token VARCHAR(80) NOT NULL,
    generation VARCHAR(40) NOT NULL DEFAULT '',
    name VARCHAR(24) NOT NULL,
    seen BIGINT NOT NULL,
    input TEXT NULL,
    input_seq BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (room, slot),
    KEY idx_members_token (token),
    CONSTRAINT fk_members_room FOREIGN KEY (room) REFERENCES rooms(code) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
  "CREATE TABLE IF NOT EXISTS signals (
    room CHAR(10) NOT NULL,
    sender INT NOT NULL,
    recipient INT NOT NULL,
    description TEXT NOT NULL,
    PRIMARY KEY (room, sender, recipient),
    CONSTRAINT fk_signals_room FOREIGN KEY (room) REFERENCES rooms(code) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
 ];
 foreach ($tables as $sql) $pdo->exec($sql);
 $stmt = $pdo->prepare("INSERT INTO potatoman_meta(name,value) VALUES('schema',?) ON DUPLICATE KEY UPDATE value=VALUES(value)");
 $stmt->execute([(string)POTATOMAN_SCHEMA]);
}
