-- Cloudflare D1 schema for travel request app

CREATE TABLE IF NOT EXISTS travel_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  from_airport_code TEXT,
  from_airport_name TEXT,
  to_airport_code TEXT,
  to_airport_name TEXT,
  trip_type TEXT NOT NULL DEFAULT 'ONE_WAY',
  pickup_location TEXT,
  dropoff_location TEXT,
  pickup_time TEXT,
  return_pickup_time TEXT,
  passenger_count INTEGER NOT NULL DEFAULT 1,
  needs_flights INTEGER NOT NULL DEFAULT 0,
  needs_accommodation INTEGER NOT NULL DEFAULT 0,
  needs_transport INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  quote_pdf_url TEXT,
  status TEXT NOT NULL DEFAULT 'WAITING_FOR_QUOTE',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_travel_requests_status
  ON travel_requests (status);


