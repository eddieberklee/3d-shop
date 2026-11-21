-- Try-on pictures made in one UTC day: one row for each visitor (a hash) and one for all (`who` = 'all').
CREATE TABLE IF NOT EXISTS try_on_usage (
  day TEXT NOT NULL,
  who TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, who)
);
