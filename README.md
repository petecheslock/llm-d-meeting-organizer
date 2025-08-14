# llm-d-meeting-organizer

Google Apps Script solutions for meeting management, including file organization and calendar-based notifications.

## Scripts Included

### Meeting File Organizer (`llm-d-meeting-organizer.js`)
- Detects files with configured meeting patterns (e.g., `[PUBLIC] llm-d sig-*`)
- Processes complete pairs: both "Notes by Gemini" and "Recording" files must be present
- Moves files to target folders in Google Drive
- Sends Slack notifications to corresponding channels via webhooks
- Sends error notifications to configured channel for issues
- Runs every 15 minutes via time-based trigger
- Debug mode available for testing without moving files

### Calendar Meeting Notifier (`calendar-meeting-notifier.js`)
- Monitors shared Google Calendar and sends Slack notifications for meetings
- Uses ±5 minute buffer around target times to handle trigger timing variations
- Extracts Google Meet links and meeting documents from calendar events
- Sends different messages to SIG channels vs community channel
- Prevents duplicate notifications by using precise time windows
- Uses Calendar API and Drive API for meeting data
- Includes multiple debug functions for testing

## Quick Start

### File Organizer Setup
1. **Copy the script**: Go to [script.google.com](https://script.google.com) and create a new project
2. **Paste the code**: Copy all contents from `llm-d-meeting-organizer.js`
3. **Create config**: Add a new file called `config.js` with your folder IDs and webhook URLs (see `config.example.js`)
4. **Test first**: Run `testDebugMode()` to verify configuration without moving files
5. **Run setup**: Execute `setupAutomaticTrigger()` to enable automatic scheduling

**Full setup instructions**: See [LLM-D_MEETING_ORGANIZER.md](./LLM-D_MEETING_ORGANIZER.md)

### Calendar Notifier Setup
1. **Create new script**: Create a Google Apps Script project and paste `calendar-meeting-notifier.js`
2. **Enable APIs**: Add Google Calendar API and Google Drive API in project services
3. **Create config**: Copy `config.example.js` to create `config.js` with your calendar ID and webhooks
4. **Test timing logic**: Run `testTimingWindow()` to see how the timing system works
5. **Test configuration**: Run `testConfig()` to verify all settings are correct
6. **Test with real data**: Run `testNextMeetingNotification()` to test with your actual next meeting
7. **Setup triggers**: Execute `setupCalendarTrigger()` to create :00 and :30 triggers
8. **Verify operation**: Check that triggers are created and monitor for live notifications

**Full setup instructions**: See [CALENDAR_MEETING_NOTIFIER.md](./CALENDAR_MEETING_NOTIFIER.md)

## File Processing

The application:

1. Searches for files matching configured meeting patterns (e.g., `[PUBLIC] llm-d sig-*`, `[PUBLIC] llm-d Community Meeting`)
2. Groups files by meeting configuration
3. Only processes complete pairs where both "Notes by Gemini" and "Recording" files are present
4. Moves all matching files to the exact target folder specified in configuration
5. Posts notification to the corresponding Slack channel via webhook
6. Supports debug mode for safe testing without file movement

## Prerequisites

- Google Workspace account
- Slack workspace with webhook permissions
- Shared Google Drive folder for organizing files

## Files in This Repository

### Scripts
- `llm-d-meeting-organizer.js` - File organizer Google Apps Script implementation
- `calendar-meeting-notifier.js` - Calendar notification Google Apps Script implementation

### Configuration
- `config.example.js` - Configuration template for both scripts
- `slack-app-manifest.yaml` - Slack app configuration for webhook setup

### Documentation
- `LLM-D_MEETING_ORGANIZER.md` - File organizer setup instructions
- `CALENDAR_MEETING_NOTIFIER.md` - Calendar notifier setup instructions
- `README.md` - This overview

## Architecture

### Calendar Timing System

The Calendar Notifier uses a timing system to handle Google Apps Script trigger variations:

1. **Target Detection**: Finds nearest :00 or :30 time when script runs
2. **±5 Minute Buffer**: Searches around target time to handle timing variations  
3. **Duplicate Prevention**: Each meeting gets one notification from appropriate trigger

**Examples:**
- Script at 2:02 PM → targets 2:00 PM → searches 1:55-2:05 PM
- Script at 2:27 PM → targets 2:30 PM → searches 2:25-2:35 PM

### Two Independent Scripts

1. **File Organizer**: Post-meeting file organization with folder monitoring
2. **Calendar Notifier**: Pre-meeting notifications with timing tolerance

**Benefits:**
- Each script only requests needed APIs
- Can be updated and deployed separately
- Issues in one script don't affect the other
- Clear separation: File organization vs meeting notifications

## Security & Permissions

### File Organizer Requirements:
- **Google Drive**: Read/write access to organize meeting files
- **Slack**: Webhook URLs for file organization notifications

### Calendar Notifier Requirements:
- **Google Calendar API**: Read calendar events and conference data
- **Google Drive API**: Read file names for meeting documents  
- **Slack**: Webhook URLs for meeting notifications

Both scripts use secure webhook-based Slack integration and read-only calendar access.
