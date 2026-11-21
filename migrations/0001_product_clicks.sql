-- Product click counts: they set the order of products on a shop's shelves.
CREATE TABLE IF NOT EXISTS product_clicks (
  id TEXT PRIMARY KEY,
  clicks INTEGER NOT NULL DEFAULT 0
);
