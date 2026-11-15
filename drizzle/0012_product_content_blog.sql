ALTER TABLE products ADD COLUMN short_description TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN benefits TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN how_to_use TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN suitable_for TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN net_weight TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN origin TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN faq_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE products ADD COLUMN seo_title TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN seo_description TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  cover_url TEXT,
  category TEXT NOT NULL DEFAULT 'راهنمای سلامت',
  tags_json TEXT NOT NULL DEFAULT '[]',
  product_id TEXT,
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  published_at TEXT,
  author_name TEXT NOT NULL DEFAULT 'طب احمدی',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS blog_posts_status_date_idx ON blog_posts(status,published_at);
CREATE INDEX IF NOT EXISTS blog_posts_product_idx ON blog_posts(product_id);
