const { query } = require('../config/database');

const CORE_TABLE_QUERIES = [
  `
  CREATE TABLE IF NOT EXISTS users (
    id INT NOT NULL AUTO_INCREMENT,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(191) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY users_username_unique (username),
    UNIQUE KEY users_email_unique (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  `
  CREATE TABLE IF NOT EXISTS user_region_inventory (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    region_id INT NOT NULL,
    nova_crystal INT NOT NULL DEFAULT 0,
    nova_shards INT NOT NULL DEFAULT 0,
    star_crystal INT NOT NULL DEFAULT 0,
    gemstone INT NOT NULL DEFAULT 0,
    wild_shards INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY user_region_inventory_unique (user_id, region_id),
    KEY user_region_inventory_user_idx (user_id),
    KEY user_region_inventory_region_idx (region_id),
    CONSTRAINT user_region_inventory_user_fk FOREIGN KEY (user_id)
      REFERENCES users (id)
      ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  `
  CREATE TABLE IF NOT EXISTS user_app_state (
    user_id INT NOT NULL,
    app_state_json JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    CONSTRAINT user_app_state_user_fk FOREIGN KEY (user_id)
      REFERENCES users (id)
      ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `
];

const REQUIRED_BASE_TABLES = [
  'champion',
  'champion_all_relics',
  'cost',
  'level',
  'region',
  'stars',
  'constellation_number',
  'relics_common',
  'relics_rare',
  'relics_epic',
  'site_data_json'
];

async function ensureCoreTables() {
  for (const ddl of CORE_TABLE_QUERIES) {
    await query(ddl);
  }
}

async function getMissingBaseTables() {
  const placeholders = REQUIRED_BASE_TABLES.map(() => '?').join(', ');
  const rows = await query(
    `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name IN (${placeholders})
    `,
    REQUIRED_BASE_TABLES
  );

  const existing = new Set(rows.map((row) => row.table_name));
  return REQUIRED_BASE_TABLES.filter((tableName) => !existing.has(tableName));
}

module.exports = {
  ensureCoreTables,
  getMissingBaseTables,
  REQUIRED_BASE_TABLES
};
