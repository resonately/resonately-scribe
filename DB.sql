# Open SQLite terminal and connect to your database
sqlite3 app.db

# Create the tables
CREATE TABLE IF NOT EXISTS recordings (
  id TEXT PRIMARY KEY NOT NULL,
  startDate TEXT,
  appointmentId TEXT,
  endDate TEXT,
  status TEXT,
  chunkCounter INTEGER
);

CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recordingId TEXT,
  position INTEGER,
  isLastChunk INTEGER,
  uri TEXT,
  startTime TEXT,
  endTime TEXT,
  status TEXT,
  FOREIGN KEY (recordingId) REFERENCES recordings(id)
);

# Insert into recordings table
INSERT INTO recordings (id, startDate, appointmentId, endDate, status, chunkCounter)
VALUES ('rec1', '2024-01-01T10:00:00Z', 'apt1', '2024-01-01T11:00:00Z', 'completed', 5);

# Insert into chunks table
INSERT INTO chunks (recordingId, position, isLastChunk, uri, startTime, endTime, status)
VALUES ('rec1', 1, 0, 'file://chunk1', '2024-01-01T10:00:00Z', '2024-01-01T10:10:00Z', 'completed');

# Insert another chunk
INSERT INTO chunks (recordingId, position, isLastChunk, uri, startTime, endTime, status)
VALUES ('rec1', 2, 1, 'file://chunk2', '2024-01-01T10:10:00Z', '2024-01-01T10:20:00Z', 'completed');

# Verify the insertions
SELECT * FROM recordings;
SELECT * FROM chunks WHERE recordingId = 'rec1';

# Exit SQLite terminal
.exit
