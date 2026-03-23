const { query } = require('../config/database');

const CORE_TABLE_QUERIES = [
  `
  CREATE TABLE IF NOT EXISTS users (
    id INT NOT NULL AUTO_INCREMENT,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(191) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    terms_version_accepted VARCHAR(32) NULL,
    terms_accepted_at DATETIME NULL,
    privacy_version_accepted VARCHAR(32) NULL,
    privacy_accepted_at DATETIME NULL,
    marketing_consent TINYINT(1) NOT NULL DEFAULT 0,
    marketing_consent_updated_at DATETIME NULL,
    data_retention_until DATETIME NULL,
    last_login_at DATETIME NULL,
    is_guest TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY users_username_unique (username),
    UNIQUE KEY users_email_unique (email),
    KEY users_data_retention_idx (data_retention_until),
    KEY users_is_guest_idx (is_guest)
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
  `,
  `
  CREATE TABLE IF NOT EXISTS user_audit_log (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id INT NULL,
    event_type VARCHAR(80) NOT NULL,
    event_payload JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY user_audit_log_user_idx (user_id),
    KEY user_audit_log_event_idx (event_type),
    CONSTRAINT user_audit_log_user_fk FOREIGN KEY (user_id)
      REFERENCES users (id)
      ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `
];

const USER_COMPLIANCE_COLUMNS = [
  {
    name: 'terms_version_accepted',
    definition: 'VARCHAR(32) NULL',
    after: 'password_hash'
  },
  {
    name: 'terms_accepted_at',
    definition: 'DATETIME NULL',
    after: 'terms_version_accepted'
  },
  {
    name: 'privacy_version_accepted',
    definition: 'VARCHAR(32) NULL',
    after: 'terms_accepted_at'
  },
  {
    name: 'privacy_accepted_at',
    definition: 'DATETIME NULL',
    after: 'privacy_version_accepted'
  },
  {
    name: 'marketing_consent',
    definition: 'TINYINT(1) NOT NULL DEFAULT 0',
    after: 'privacy_accepted_at'
  },
  {
    name: 'marketing_consent_updated_at',
    definition: 'DATETIME NULL',
    after: 'marketing_consent'
  },
  {
    name: 'data_retention_until',
    definition: 'DATETIME NULL',
    after: 'marketing_consent_updated_at'
  },
  {
    name: 'last_login_at',
    definition: 'DATETIME NULL',
    after: 'data_retention_until'
  },
  {
    name: 'is_guest',
    definition: 'TINYINT(1) NOT NULL DEFAULT 0',
    after: 'last_login_at'
  }
];

const USERS_REQUIRED_INDEXES = [
  { name: 'users_data_retention_idx', definition: '`data_retention_until`' },
  { name: 'users_is_guest_idx', definition: '`is_guest`' }
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

async function hasColumn(tableName, columnName) {
  const rows = await query(
    `
    SELECT 1 AS found
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = ?
      AND column_name = ?
    LIMIT 1
    `,
    [tableName, columnName]
  );

  return rows.length > 0;
}

async function addColumnIfMissing(tableName, column) {
  const exists = await hasColumn(tableName, column.name);
  if (exists) {
    return;
  }

  const afterClause = column.after ? ` AFTER \`${column.after}\`` : '';
  await query(
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`${column.name}\` ${column.definition}${afterClause};`
  );
}

async function hasIndex(tableName, indexName) {
  const rows = await query(
    `
    SELECT 1 AS found
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = ?
      AND index_name = ?
    LIMIT 1
    `,
    [tableName, indexName]
  );

  return rows.length > 0;
}

async function addIndexIfMissing(tableName, indexName, definition) {
  const exists = await hasIndex(tableName, indexName);
  if (exists) {
    return;
  }

  await query(`ALTER TABLE \`${tableName}\` ADD INDEX \`${indexName}\` (${definition});`);
}

async function ensureUsersComplianceSchema() {
  for (const column of USER_COMPLIANCE_COLUMNS) {
    await addColumnIfMissing('users', column);
  }

  for (const index of USERS_REQUIRED_INDEXES) {
    await addIndexIfMissing('users', index.name, index.definition);
  }
}

async function ensureCoreTables() {
  for (const ddl of CORE_TABLE_QUERIES) {
    await query(ddl);
  }

  await ensureUsersComplianceSchema();
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
