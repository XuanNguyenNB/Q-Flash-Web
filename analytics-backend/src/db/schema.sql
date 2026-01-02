-- Q-Flash Analytics Database Schema

-- Sessions table - tracks unique visitors and their sessions
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    visitor_id TEXT NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_agent TEXT,
    browser TEXT,
    browser_version TEXT,
    os TEXT,
    os_version TEXT,
    device_type TEXT DEFAULT 'desktop',
    screen_width INTEGER,
    screen_height INTEGER,
    language TEXT,
    referrer TEXT,
    landing_page TEXT,
    country TEXT,
    city TEXT
);

-- Pageviews table - tracks page visits
CREATE TABLE IF NOT EXISTS pageviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    path TEXT NOT NULL,
    title TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    time_on_page INTEGER DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Events table - tracks user interactions
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    category TEXT NOT NULL,
    action TEXT NOT NULL,
    label TEXT,
    value TEXT,
    metadata TEXT, -- JSON string for extra data
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Errors table - tracks JavaScript errors
CREATE TABLE IF NOT EXISTS errors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    error_type TEXT DEFAULT 'js',
    message TEXT NOT NULL,
    stack TEXT,
    url TEXT,
    line INTEGER,
    column INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

-- Admin users table - for dashboard authentication
CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- Daily stats aggregation table - for faster queries
CREATE TABLE IF NOT EXISTS daily_stats (
    date TEXT PRIMARY KEY,
    total_sessions INTEGER DEFAULT 0,
    total_pageviews INTEGER DEFAULT 0,
    total_events INTEGER DEFAULT 0,
    total_errors INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    avg_session_duration INTEGER DEFAULT 0,
    desktop_count INTEGER DEFAULT 0,
    mobile_count INTEGER DEFAULT 0,
    tablet_count INTEGER DEFAULT 0
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sessions_visitor ON sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_pageviews_session ON pageviews(session_id);
CREATE INDEX IF NOT EXISTS idx_pageviews_timestamp ON pageviews(timestamp);
CREATE INDEX IF NOT EXISTS idx_pageviews_path ON pageviews(path);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_errors_timestamp ON errors(timestamp);
