# Calendar Meeting Notifier Setup Guide

Google Apps Script that monitors a shared Google Calendar and sends Slack notifications exactly when LLM-D meetings start. Includes intelligent storage management and comprehensive testing functions.

## How It Works

### Timing System
The script sends notifications when meetings are actually starting:

1. **Precise Detection**: Runs every minute and looks for meetings starting within ±90 seconds
   - Meeting at 2:00:00 PM gets notified between 1:58:30-2:01:30 PM
   - Accounts for Google Apps Script trigger timing variations
   - No more early notifications - alerts sent when meetings begin

2. **Smart Tracking**: Prevents duplicate notifications with intelligent record-keeping
   - Each meeting gets exactly one notification using unique identifiers
   - PropertiesService stores which meetings have been notified
   - Automatic cleanup prevents storage overflow

3. **Examples**:
   - Script at 1:59:30 PM → Finds 2:00:00 PM meeting → ✅ NOTIFY (30s early)
   - Script at 2:00:15 PM → Finds 2:00:00 PM meeting → ✅ NOTIFY (15s late) 
   - Script at 2:01:35 PM → Meeting already notified → ⏭️ Skip

## Features

- **Precise timing**: Notifications sent at meeting start time (±90 seconds)
- **Duplicate prevention**: Intelligent tracking ensures one notification per meeting
- **Storage management**: Multi-layered cleanup prevents PropertiesService overflow
- **Smart cleanup**: Adapts cleanup frequency based on storage usage (4h/8h/24h)
- **Daily maintenance**: End-of-day cleanup at 11:30 PM removes old records
- **Storage monitoring**: Health alerts when storage reaches 80% capacity
- **Uses Calendar API**: Advanced meeting data extraction with conference info
- **Document detection**: Finds and displays meeting documents with actual file names
- **Channel-specific messaging**: Different content for SIG vs community channels
- **Comprehensive testing**: Multiple debug functions for setup and monitoring

## Meeting Notification Rules

- **SIG Meetings**: 
  - Posted to the specific SIG channel: "The weekly public llm-d sig-name meeting is starting NOW! Join us!"
  - Posted to #community channel: "The weekly public llm-d sig-name meeting is starting NOW! Join the #sig-channel channel for detailed discussion."
- **Community Meeting**: Posted only to #community channel: "The weekly public llm-d Community Meeting is starting NOW! Join us!"
- **Content**: Notifications include Google Meet links and attached documents when available
- **Timing**: All notifications sent exactly when meetings begin, not in advance

## Prerequisites

- Google Workspace account with Calendar and Drive access
- Slack workspace with webhook permissions
- Access to the shared Google Calendar you want to monitor
- Google Apps Script project with Calendar API and Drive API enabled
- Configuration matching your meeting organizer setup

## Setup Instructions

### Step 1: Get Calendar ID

1. Go to [Google Calendar](https://calendar.google.com)
2. Find the shared calendar you want to monitor
3. Click the three dots next to the calendar name
4. Select "Settings and sharing"
5. Scroll down to "Calendar ID" and copy the value (usually in email format)

### Step 2: Create the Google Apps Script

1. Go to [script.google.com](https://script.google.com)
2. Click "New Project"
3. Name it: "LLM-D Calendar Meeting Notifier"
4. Delete the default `myFunction()` code
5. Copy and paste the entire contents of `calendar-meeting-notifier.js`

### Step 3: Enable Required APIs

1. **Enable Google Calendar API**:
   - In your Google Apps Script project, click the ⚙️ gear icon (Project Settings)
   - Go to "Services" 
   - Click "+ Add a service"
   - Find "Google Calendar API" and add it with identifier "Calendar"

2. **Enable Google Drive API**:
   - Click "+ Add a service" again
   - Find "Google Drive API" and add it with identifier "Drive"

### Step 4: Create Configuration File

1. **Create config.js in your calendar notifier script**:
   - In your calendar notifier script, click the "+" next to "Files" 
   - Add a new script file called `config`
   - Copy the contents from `config.example.js` and update with your values:

   ```javascript
   const CONFIG = {
     DEBUG_MODE: false,
     CALENDAR_ID: 'your-calendar-id@group.calendar.google.com',
     MEETING_CONFIGS: {
       '[PUBLIC] llm-d sig-autoscaling': {
         targetFolderId: 'not-needed-for-calendar',
         slackWebhook: 'YOUR_SLACK_WEBHOOK_URL',
         slackChannel: '#sig-autoscaling'
       },
       // ... add all your meeting configurations here ...
     },
     DEFAULT_WEBHOOK: 'YOUR_DEFAULT_WEBHOOK_URL'
   };
   ```

2. **Get your calendar ID**:
   - Go to [Google Calendar](https://calendar.google.com)
   - Find your shared calendar
   - Click Settings → Calendar settings → Calendar ID
   - Copy the ID (usually ends with @group.calendar.google.com)

### Step 4: Test Configuration

1. In Google Apps Script, run the `debugListUpcomingEvents()` function
2. Grant necessary permissions when prompted:
   - Google Calendar: Read calendar events
   - External requests: Send Slack notifications
3. Check the execution log to see if events are found

### Step 5: Test Slack Notifications

1. Run `testCalendarNotifier()` function for full flow testing
2. Run `testNextMeetingNotification()` to test with your actual next meeting
3. These run in debug mode and send test messages to your error channel
4. Verify the message formatting looks good for both SIG and community channels
5. Check that Google Meet links and document attachments are properly formatted

### Step 8: Setup Automatic Triggers

1. **Main notification trigger**: Run the `setupCalendarTrigger()` function once
   - Creates a trigger to run every minute (ensuring notifications within 90 seconds of meeting start)
   - Replaces any existing triggers for the same function

2. **Storage management trigger**: Run the `setupCleanupTriggers()` function once  
   - Creates daily cleanup trigger (runs at 11:30 PM)
   - Prevents PropertiesService storage overflow
   - Only sends alerts on failures, not successes

3. Both setup functions log confirmation messages

### Step 9: Verify Setup

1. Check Google Apps Script triggers:
   - Go to "Triggers" in the left sidebar  
   - Verify there is ONE trigger for `checkCalendarAndNotify` that runs every minute
   - Verify there is ONE trigger for `dailyCleanupNotificationRecords` that runs daily at 11:30 PM

2. **Monitor storage health**: Run `monitorStorageHealth()` to check current usage
   - Should show 0/50 properties initially (healthy storage)
   - Will show utilization percentage as meetings get tracked

3. **Test live notifications**: Wait for meetings to start and verify:
   - Notifications appear within 90 seconds of meeting start time
   - No duplicate notifications for the same meeting
   - Only one notification per meeting across multiple trigger runs

4. Monitor your error channel for:
   - Storage warnings (only if issues occur)
   - Any processing errors
   - Setup confirmations

## Testing and Debugging

### Debug Functions

**Configuration & Setup:**
- `testConfig()` - Verify configuration is loaded and all required fields are present
- `setupCalendarTrigger()` - Create the every-minute trigger (run once)
- `setupCleanupTriggers()` - Create the daily cleanup trigger (run once)

**Meeting Detection & Testing:**  
- `testTimingWindow()` - Shows how ±90 second timing logic works with examples
- `testCalendarNotifier()` - End-to-end test in debug mode (sends to error channel)
- `debugListUpcomingEvents()` - List all events found in current search window
- `testNextMeetingNotification()` - Find and test your next real meeting (searches 7 days ahead)

**Storage Management & Monitoring:**
- `monitorStorageHealth()` - Complete storage utilization report with health status
- `listNotificationRecords()` - Show all current notification tracking records  
- `clearAllNotificationRecords()` - Clear all tracking records (for testing)
- `dailyCleanupNotificationRecords()` - Manual daily cleanup (6-hour cutoff)
- `cleanupOldNotificationRecords()` - Manual smart cleanup (adaptive timing)

### Debug Mode

Set `DEBUG_MODE: true` in your config to:
- Send all notifications to the error channel instead of actual channels
- Add `[DEBUG for #channel-name]` prefix to all messages
- Test message formatting without spamming channels

### Common Issues

1. **"CONFIG is not defined"**
   - Make sure you created a `config.js` file in your calendar notifier script
   - Verify the file contains a global `CONFIG` variable
   - Check that all required fields are included

2. **"Calendar not found"**
   - Verify the `CALENDAR_ID` is correct in your config.js
   - Ensure the calendar is shared with your Google account
   - Check that the calendar ID includes the full domain (e.g., `@group.calendar.google.com`)

3. **"No meetings starting now"**
   - Run `debugListUpcomingEvents()` to see what events exist
   - Verify events have titles that match your configured prefixes
   - Check that events are starting within ±90 seconds of current time
   - Use `testTimingWindow()` to understand the detection window

4. **"Slack notifications not sent"**
   - Verify webhook URLs are correct in your config.js
   - Check that the DEFAULT_WEBHOOK is working
   - Test with `testCalendarNotifier()` in debug mode

5. **"Permissions denied"**
   - Re-run functions to grant additional permissions
   - Ensure your Google account has access to the calendar
   - Check Google Apps Script execution permissions

6. **Storage/duplicate notification issues**
   - Run `monitorStorageHealth()` to check PropertiesService usage
   - If storage is full (near 50/50 properties), run `cleanupOldNotificationRecords()`
   - Use `listNotificationRecords()` to see what's being tracked
   - For testing, use `clearAllNotificationRecords()` to reset tracking

### Monitoring

- **Error notifications**: Automatically sent to your error webhook channel
- **Storage health**: Monitor with `monitorStorageHealth()` function  
- **Execution logs**: Use the execution transcript in Google Apps Script for detailed logs
- **Quiet operation**: System runs silently unless there are issues
- **Storage alerts**: Only sent when storage reaches 80% or cleanup issues occur

## Calendar Integration Tips

### Meeting Title Format

Ensure calendar events use the exact prefixes from your config:
- `[PUBLIC] llm-d sig-autoscaling: Weekly Planning`
- `[PUBLIC] llm-d Community Meeting`
- `[PUBLIC] llm-d sig-benchmarking: Sprint Review`

### Google Meet Links

The script extracts Google Meet links from:
- **Conference data** (preferred - most reliable)
- Event description (fallback)
- Event location field (fallback)

### Document Sharing

For best results with document detection:
- Attach documents directly to calendar events when possible
- Include Google Drive links in event descriptions
- Use standard Google Drive sharing links

### How the Timing System Works

The script sends notifications exactly when meetings start using precise detection and smart tracking:

#### Meeting Start Detection
- **Runs every minute** for maximum precision
- **±90 second window**: Finds meetings starting within 90 seconds of current time  
- **No advance notifications**: Alerts sent when meetings actually begin, not beforehand
- **Accounts for trigger variations**: Google Apps Script triggers may run a few seconds early/late

#### Timing Examples

| Current Time | Meeting Start | Seconds Difference | Action | Result |
|---|---|---|---|---|
| 1:58:45 PM | 2:00:00 PM | +75s | ✅ NOTIFY | 1m 15s early |
| 1:59:30 PM | 2:00:00 PM | +30s | ✅ NOTIFY | 30s early |
| 2:00:00 PM | 2:00:00 PM | 0s | ✅ NOTIFY | Exactly on time 🎯 |
| 2:00:45 PM | 2:00:00 PM | -45s | ✅ NOTIFY | 45s late |
| 2:01:30 PM | 2:00:00 PM | -90s | ✅ NOTIFY | 1m 30s late |
| 2:02:00 PM | 2:00:00 PM | -120s | ❌ Skip | Too late (already notified) |

#### Intelligent Duplicate Prevention

The system prevents duplicate notifications using PropertiesService tracking:

1. **Unique Identification**: Each meeting gets a unique key based on:
   - Calendar event ID  
   - Meeting start time
   - Creates key like: `notified_eventid123_2024-01-15T14:00:00.000Z`

2. **Smart Tracking**: Before sending notifications:
   - Check if key exists in PropertiesService
   - If exists → Skip (already notified)
   - If not → Send notifications and record key

3. **Example Flow**:
   ```
   1:59:30 PM → Meeting found → No record → ✅ Send notifications → Record key
   2:00:15 PM → Same meeting found → Record exists → ⏭️ Skip notifications  
   2:00:45 PM → Same meeting found → Record exists → ⏭️ Skip notifications
   ```

#### Storage Management

The system automatically manages tracking records to prevent storage overflow:

**Smart Cleanup Frequency:**
- **< 30 records**: 24-hour cleanup (normal load)
- **30-45 records**: 8-hour cleanup (moderate load) 
- **45+ records**: 4-hour cleanup (high load)
- **48+ records**: Emergency cleanup (remove oldest immediately)

**Daily Maintenance:**  
- **11:30 PM cleanup**: Removes records older than 6 hours
- **Health monitoring**: Alerts when storage reaches 80% capacity (40/50 properties)
- **Automatic alerts**: Only sends notifications when there are issues

#### Resource Usage

Running every minute is well within Google Apps Script limits:

| Resource | Daily Limit | Usage (1-min) | Status |
|---|---|---|---|
| **Script runtime** | 6 hours | ~24 minutes | ✅ 0.7% of limit |
| **Triggers** | 20 per script | 2 triggers | ✅ 10% of limit |
| **Calendar API** | 1,000,000 calls | ~1,440 calls | ✅ 0.1% of limit |  
| **URL fetches** | 20,000 calls | Variable | ✅ Safe |
| **PropertiesService** | 50 properties | Auto-managed | ✅ Monitored |

**Verdict**: Every minute frequency is perfectly safe and provides optimal precision.

### Storage Health Monitoring

Use these commands to monitor and maintain your system:

```javascript
// Check current storage usage and health
monitorStorageHealth()

// View all notification tracking records  
listNotificationRecords()

// Manual cleanup if needed (emergency use)
cleanupOldNotificationRecords()

// Clear all records (testing only)
clearAllNotificationRecords()
```

**Normal Operation**: System runs silently with automatic maintenance. You'll only get alerts if there are issues.

### Customizing Cleanup Frequency

The system automatically adapts, but you can adjust timing in the code:

```javascript
// In cleanupOldNotificationRecords() - line ~460
// Current: 4h/8h/24h adaptive cleanup
if (notificationRecords.length >= 45) {
  cutoffHours = 4;  // Very aggressive - change to 6 for less aggressive
} else if (notificationRecords.length >= 30) {  
  cutoffHours = 8;  // Moderate - change to 12 for less aggressive  
} else {
  cutoffHours = 24; // Normal - change to 48 for longer retention
}
```

**Recommendation**: The default adaptive system works well for most use cases.

## Security Notes

- Calendar access is read-only
- Webhook URLs should be kept secure in your `config.js`
- The script only processes events matching your configured prefixes
- All error notifications include timestamps for audit purposes

## Troubleshooting

### Quick Diagnosis

If notifications aren't working:

1. **Check timing**: Run `testTimingWindow()` to understand detection window
2. **Check configuration**: Run `testConfig()` to verify all settings  
3. **Check meetings**: Run `debugListUpcomingEvents()` to see what events exist
4. **Check storage**: Run `monitorStorageHealth()` to verify tracking system
5. **Test end-to-end**: Run `testNextMeetingNotification()` with real meeting

### Storage Issues

If getting duplicate notifications or storage errors:

1. **Check usage**: `monitorStorageHealth()` shows current utilization
2. **Manual cleanup**: `cleanupOldNotificationRecords()` for immediate cleanup
3. **View records**: `listNotificationRecords()` shows what's tracked
4. **Reset for testing**: `clearAllNotificationRecords()` clears all tracking

### System Health

- **Execution logs**: Google Apps Script → Executions tab for detailed error messages
- **Error channel**: Monitor your DEFAULT_WEBHOOK channel for automated alerts
- **Calendar permissions**: Ensure your account can read the shared calendar  
- **Webhook testing**: Verify URLs work in debug mode before live deployment

**The system is designed to run quietly** - you should only get notifications when there are actual issues to address.
