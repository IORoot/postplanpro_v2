export const schema = `
-- Webhook configurations (Settings)
CREATE TABLE IF NOT EXISTS webhook_config (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  api_token TEXT,
  api_key TEXT
);

-- Optional HTTP headers per webhook (sent with every request)
CREATE TABLE IF NOT EXISTS webhook_header (
  id TEXT PRIMARY KEY,
  webhook_id TEXT NOT NULL REFERENCES webhook_config(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_webhook_header_webhook ON webhook_header(webhook_id);

-- Global variables merged into every outbound JSON
CREATE TABLE IF NOT EXISTS global_variable (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  type TEXT DEFAULT 'string'
);

-- Schedules (ordered list of slots)
CREATE TABLE IF NOT EXISTS schedule (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Schedule slots (date+time, ordered) – legacy fixed slots
CREATE TABLE IF NOT EXISTS schedule_slot (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES schedule(id) ON DELETE CASCADE,
  scheduled_at TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  UNIQUE(schedule_id, order_index)
);

-- Schedule recurrence rules (multiple per schedule)
-- type: cron | weekly | daily | interval | once
-- config: JSON – cron: { expression }, weekly: { dayOfWeek, time }, daily: { time }, interval: { amount, unit }, once: { at }
-- start_at: NULL = immediately, else ISO datetime
-- end_at: NULL = forever, else ISO datetime
CREATE TABLE IF NOT EXISTS schedule_rule (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES schedule(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('cron', 'weekly', 'daily', 'monthly', 'yearly', 'interval', 'once')),
  config TEXT NOT NULL,
  start_at TEXT,
  end_at TEXT,
  order_index INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_schedule_rule_schedule ON schedule_rule(schedule_id);

-- Schedule-level custom fields (applied to posts when schedule is used)
CREATE TABLE IF NOT EXISTS schedule_field (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES schedule(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'string',
  value TEXT
);

-- Posts
CREATE TABLE IF NOT EXISTS post (
  id TEXT PRIMARY KEY,
  webhook_id TEXT NOT NULL REFERENCES webhook_config(id),
  schedule_id TEXT REFERENCES schedule(id),
  title TEXT NOT NULL,
  content TEXT,
  scheduled_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'failed')),
  sent_at TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Post custom fields (included in webhook JSON)
CREATE TABLE IF NOT EXISTS post_field (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES post(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'string',
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_post_webhook ON post(webhook_id);
CREATE INDEX IF NOT EXISTS idx_post_scheduled_at ON post(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_post_status ON post(status);
CREATE INDEX IF NOT EXISTS idx_schedule_slot_schedule ON schedule_slot(schedule_id);
CREATE INDEX IF NOT EXISTS idx_post_field_post ON post_field(post_id);
CREATE INDEX IF NOT EXISTS idx_schedule_field_schedule ON schedule_field(schedule_id);

-- Send log: one row per send (manual or cron) for reports
CREATE TABLE IF NOT EXISTS send_log (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES post(id) ON DELETE CASCADE,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  request_json TEXT NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  success INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_send_log_post ON send_log(post_id);
CREATE INDEX IF NOT EXISTS idx_send_log_sent_at ON send_log(sent_at);
`;
