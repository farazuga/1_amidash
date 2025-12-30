-- Migration: Outlook Calendar Integration
-- Description: Add tables for storing Microsoft Outlook OAuth connections and synced events

-- Store OAuth connections for calendar providers (currently Microsoft Outlook)
CREATE TABLE IF NOT EXISTS calendar_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL DEFAULT 'microsoft',
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  outlook_email TEXT,
  calendar_id TEXT DEFAULT 'primary',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Track synced events so we can update/delete them in external calendars
CREATE TABLE IF NOT EXISTS synced_calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID REFERENCES project_assignments(id) ON DELETE CASCADE NOT NULL,
  connection_id UUID REFERENCES calendar_connections(id) ON DELETE CASCADE NOT NULL,
  external_event_id TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  sync_error TEXT, -- Store last error message if sync failed
  UNIQUE(assignment_id, connection_id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_calendar_connections_user_id ON calendar_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_provider ON calendar_connections(provider);
CREATE INDEX IF NOT EXISTS idx_synced_calendar_events_assignment_id ON synced_calendar_events(assignment_id);
CREATE INDEX IF NOT EXISTS idx_synced_calendar_events_connection_id ON synced_calendar_events(connection_id);

-- Enable RLS
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE synced_calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for calendar_connections
-- Users can view their own connections
CREATE POLICY "Users can view own connections" ON calendar_connections
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own connections
CREATE POLICY "Users can insert own connections" ON calendar_connections
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own connections
CREATE POLICY "Users can update own connections" ON calendar_connections
  FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own connections
CREATE POLICY "Users can delete own connections" ON calendar_connections
  FOR DELETE USING (user_id = auth.uid());

-- Admins can view all connections (for debugging/support)
CREATE POLICY "Admins can view all connections" ON calendar_connections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS policies for synced_calendar_events
-- Users can view synced events for their connections
CREATE POLICY "Users can view own synced events" ON synced_calendar_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM calendar_connections
      WHERE calendar_connections.id = synced_calendar_events.connection_id
      AND calendar_connections.user_id = auth.uid()
    )
  );

-- Service role can manage all synced events (for background sync jobs)
-- This is handled by using the service client in the sync logic

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_calendar_connection_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER calendar_connections_updated_at
  BEFORE UPDATE ON calendar_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_connection_updated_at();

-- Add comment for documentation
COMMENT ON TABLE calendar_connections IS 'Stores OAuth tokens for external calendar integrations (Microsoft Outlook, Google Calendar)';
COMMENT ON TABLE synced_calendar_events IS 'Tracks which assignment events have been synced to external calendars for update/delete operations';
COMMENT ON COLUMN calendar_connections.provider IS 'Calendar provider: microsoft, google (future)';
COMMENT ON COLUMN calendar_connections.calendar_id IS 'Which calendar to sync to (default: primary)';
COMMENT ON COLUMN synced_calendar_events.external_event_id IS 'The event ID in the external calendar system';
COMMENT ON COLUMN synced_calendar_events.sync_error IS 'Last sync error message, null if successful';
