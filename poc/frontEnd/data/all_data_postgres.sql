-- Converted from MySQL to PostgreSQL (Supabase)
-- Generated at 2026-03-18T13:10:54.307Z
-- Review the result before production usage.

-- Unified SQL dump (all data)
BEGIN;

DROP TABLE IF EXISTS constellation_number;
CREATE TABLE "constellation_number" (
  "constellation_id" INTEGER,
  "constellation_value" INTEGER
);

DROP TABLE IF EXISTS cost;
CREATE TABLE "cost" (
  "cost_id" INTEGER,
  "cost_value" INTEGER
);

DROP TABLE IF EXISTS "level";
CREATE TABLE "level" (
  "level_id" INTEGER,
  "actual_level" INTEGER,
  "level_needed" INTEGER
);

DROP TABLE IF EXISTS region;
CREATE TABLE "region" (
  "region_id" INTEGER,
  "region_name" TEXT,
  "region_icon" TEXT
);

DROP TABLE IF EXISTS stars;
CREATE TABLE "stars" (
  "stars_id" INTEGER,
  "stars_value" INTEGER
);

DROP TABLE IF EXISTS relics_common;
CREATE TABLE "relics_common" (
  "relic_id" TEXT,
  "relic_name" TEXT,
  "relic_rarity" TEXT,
  "relic_description" TEXT,
  "relic_icon" TEXT
);

DROP TABLE IF EXISTS relics_rare;
CREATE TABLE "relics_rare" (
  "relic_id" TEXT,
  "relic_name" TEXT,
  "relic_rarity" TEXT,
  "relic_description" TEXT,
  "relic_icon" TEXT
);

DROP TABLE IF EXISTS relics_epic;
CREATE TABLE "relics_epic" (
  "relic_id" TEXT,
  "relic_name" TEXT,
  "relic_rarity" TEXT,
  "relic_description" TEXT,
  "relic_icon" TEXT
);

DROP TABLE IF EXISTS champion;
CREATE TABLE "champion" (
  "champion_id" INTEGER,
  "champion_name" TEXT,
  "cost_id" INTEGER,
  "poc" INTEGER,
  "champion_icon" TEXT,
  "stars_id" INTEGER,
  "lor_exclusive" INTEGER,
  "constellation_number_id" INTEGER,
  "level_id" INTEGER,
  "region_id" INTEGER
);

DROP TABLE IF EXISTS champion_all_relics;
CREATE TABLE "champion_all_relics" (
  "champion_id" INTEGER,
  "slot_index" INTEGER,
  "relic_code" TEXT
);

DROP TABLE IF EXISTS po_c_champion;
CREATE TABLE "po_c_champion" (
  "po_c_champion_id" INTEGER,
  "po_c_champion_name" TEXT,
  "region_id" INTEGER,
  "cost_id" INTEGER,
  "stars_id" INTEGER,
  "constellation_number_id" INTEGER,
  "poc" INTEGER,
  "fragments_id" TEXT,
  "star_crystal_id" TEXT,
  "gemstone_id" TEXT,
  "crystal_nova_id" TEXT
);

DROP TABLE IF EXISTS all_relics;
CREATE TABLE all_relics AS
SELECT * FROM relics_common
UNION ALL SELECT * FROM relics_rare
UNION ALL SELECT * FROM relics_epic;

DROP TABLE IF EXISTS champion_gemstone_tiers;
CREATE TABLE "champion_gemstone_tiers" (
  "champion_name" VARCHAR(191) PRIMARY KEY,
  "tier_1" INTEGER NOT NULL,
  "tier_2" INTEGER NOT NULL,
  "tier_3" INTEGER NOT NULL,
  "tier_4" INTEGER NOT NULL
);

DROP VIEW IF EXISTS champion_gemstone_totals;
CREATE VIEW champion_gemstone_totals AS
SELECT
  champion_name,
  tier_1,
  tier_2,
  tier_3,
  tier_4,
  (tier_1 + tier_2 + tier_3 + tier_4) AS gemstone_total
FROM champion_gemstone_tiers;

DROP TABLE IF EXISTS site_data_json;
CREATE TABLE "site_data_json" (
  "id" INTEGER PRIMARY KEY,
  "payload" TEXT NOT NULL
);

COMMIT;
