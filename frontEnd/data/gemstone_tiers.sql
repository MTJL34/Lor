BEGIN TRANSACTION;

DROP TABLE IF EXISTS champion_gemstone_tiers;
CREATE TABLE champion_gemstone_tiers (
  champion_name VARCHAR(191) PRIMARY KEY,
  tier_1 INTEGER NOT NULL,
  tier_2 INTEGER NOT NULL,
  tier_3 INTEGER NOT NULL,
  tier_4 INTEGER NOT NULL
);

INSERT INTO champion_gemstone_tiers (champion_name, tier_1, tier_2, tier_3, tier_4) VALUES
  ('Norra', 150, 250, 250, 350),
  ('Vex', 150, 250, 250, 350),
  ('Yuumi', 150, 250, 250, 350),
  ('Nautilus', 150, 250, 250, 350),
  ('Pyke', 150, 250, 250, 350),
  ('Twisted Fate', 0, 250, 250, 0),
  ('Lux', 0, 250, 250, 350),
  ('Lux : Illuminated', 0, 250, 250, 350),
  ('Shyvana', 0, 0, 250, 350),
  ('Vayne', 0, 0, 250, 350),
  ('Anivia', 0, 250, 250, 350),
  ('Tryndamere', 0, 250, 250, 0),
  ('Volibear', 150, 250, 250, 350),
  ('Ahri', 150, 250, 250, 0),
  ('Lillia', 150, 250, 250, 350),
  ('Sett', 150, 250, 250, 350),
  ('Yasuo', 0, 200, 300, 400),
  ('Ambessa', 0, 250, 250, 0),
  ('Annie', 150, 250, 250, 350),
  ('Darius', 0, 0, 250, 350),
  ('Mel', 150, 250, 250, 350),
  ('Samira', 0, 0, 250, 350),
  ('Swain', 0, 200, 300, 400),
  ('Caitlyn', 0, 250, 250, 350),
  ('Ekko', 0, 250, 250, 350),
  ('Jayce', 150, 250, 250, 350),
  ('Jinx', 0, 0, 250, 0),
  ('Vi', 150, 250, 250, 350),
  ('Viktor', 0, 250, 250, 350),
  ('Warwick', 0, 250, 250, 350),
  ('Elise', 0, 0, 0, 0),
  ('Gwen', 0, 250, 250, 350),
  ('Thresh', 0, 250, 250, 350),
  ('Viego', 0, 250, 250, 350),
  ('Akshan', 150, 250, 250, 350),
  ('Azir', 150, 0, 250, 350),
  ('Kai''Sa', 0, 0, 0, 350),
  ('Taliyah', 0, 250, 250, 350),
  ('Kayle', 0, 250, 0, 0),
  ('Leona', 0, 250, 250, 350),
  ('Morgana', 150, 250, 250, 350),
  ('Aatrox', 0, 250, 250, 350),
  ('Elder Dragon', 0, 250, 250, 0),
  ('Fiddlesticks', 0, 250, 250, 0),
  ('Jhin', 0, 250, 250, 350),
  ('Neeko', 150, 250, 250, 350),
  ('The Poro King', 150, 250, 250, 350);

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

COMMIT;
