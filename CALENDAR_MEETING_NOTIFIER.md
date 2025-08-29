# Calendar Meeting Notifier Setup Guide

Google Apps Script that monitors a shared Google Calendar and sends Slack notifications for LLM-D meetings. Includes timing tolerance and content extraction.

## How It Works

### Timing System
The script uses a timing system to handle trigger variations:

1. **Target Time Detection**: When script runs, it determines the closest :00 or :30 time
   - Minutes 0-15 → targets the :00 time  
   - Minutes 16-45 → targets the :30 time
   - Minutes 46-59 → targets next hour's :00 time

2. **±5 Minute Buffer**: Searches 5 minutes before and after the target time
   - Meeting at 2:00 PM found whether script runs at 1:55 PM or 2:05 PM
   - Each meeting notified exactly once

3. **Examples**:
   - Script at 2:02 PM → Target 2:00 PM → Search 1:55-2:05 PM
   - Script at 2:27 PM → Target 2:30 PM → Search 2:25-2:35 PM

## Features

- ±5 minute tolerance around target times to handle trigger variations
- Finds nearest :00 or :30 time automatically
- Uses Calendar API for meeting data extraction
- Extracts Google Meet links from conference data
- Finds and displays meeting documents with actual file names
- Different message content for SIG vs community channels
- Multiple debug functions for testing
- Prevents duplicate notifications

## Meeting Notification Rules

- **SIG Meetings**: 
  - Posted to the specific SIG channel: "The weekly public llm-d sig-name meeting is starting NOW. Join us!"
  - Posted to #community channel: "Join the #sig-channel for detailed discussion."
- **Community Meeting**: Posted only to #community channel: "Join us!"
- **Content**: Notifications include Google Meet links and attached documents when available

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

### Step 8: Setup Automatic Trigger

1. Run the `setupCalendarTrigger()` function once
2. This creates a trigger to run every minute (ensuring notifications are sent within 30 seconds of meeting start)
3. You should see a confirmation message in your error channel

### Step 9: Verify Setup

1. Check Google Apps Script triggers:
   - Go to "Triggers" in the left sidebar
   - Verify there is ONE trigger for `checkCalendarAndNotify` that runs every minute
2. Monitor your error channel for any issues
3. Wait for the next trigger run to see live notifications
4. Verify that notifications appear within 30 seconds of meeting start

## Testing and Debugging

### Debug Functions

- `testConfig()` - Verify configuration is loaded and all required fields are present
- `testTimingWindow()` - Shows how timing logic works with examples
- `testCalendarNotifier()` - End-to-end test in debug mode (sends to error channel)
- `debugListUpcomingEvents()` - List all events found in current ±5 minute window  
- `testNextMeetingNotification()` - Find and test your next real meeting (searches 7 days ahead)
- `setupCalendarTrigger()` - Create the :00 and :30 triggers (run once)

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

3. **"No events found"**
   - Run `debugListUpcomingEvents()` to see what events exist
   - Verify events have titles that match your configured prefixes
   - Check that events are within the next 30 minutes

4. **"Slack notifications not sent"**
   - Verify webhook URLs are correct in your config.js
   - Check that the DEFAULT_WEBHOOK is working
   - Test with `testCalendarNotifier()` in debug mode

5. **"Permissions denied"**
   - Re-run functions to grant additional permissions
   - Ensure your Google account has access to the calendar
   - Check Google Apps Script execution permissions

### Monitoring

- All errors are automatically sent to your error webhook channel
- Use the execution transcript in Google Apps Script for detailed logs
- Monitor your error channel for any automated notifications

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

The script uses a smart timing system to ensure meetings are notified exactly once:

#### Trigger Frequency
- **Runs every minute** regardless of when initially set up
- **Ensures notifications within 30 seconds** of meeting start time
- **Example**: Even if trigger created at 2:17 PM, it will run at 2:17, 2:18, 2:19... 2:29, 2:30, 2:31...
  - The 2:29 or 2:30 run will catch 2:30 meetings (within 60 seconds)
  - The 2:59 or 3:00 run will catch 3:00 meetings (within 60 seconds)

#### Frequency Comparison

| Frequency | Max Early | Max Late | Runs/Hour | Resource Usage | Best For |
|---|---|---|---|---|---|
| **1 minute** | 30s | 30s | 60 | High | Maximum precision |
| **5 minutes** | 2.5min | 2.5min | 12 | Medium | Good balance |
| **15 minutes** | 7.5min | 7.5min | 4 | Low | Light usage |

#### Target Time Detection
When the script runs, it finds the nearest :00 or :30 time:
- **Minutes 0-15**: Targets the current hour's :00 time
- **Minutes 16-45**: Targets the current hour's :30 time  
- **Minutes 46-59**: Targets the next hour's :00 time

#### Search Window
- **±5 minute buffer** around target time handles minor timing variations
- **Example**: Script runs at 2:02 PM → targets 2:00 PM → searches 1:55-2:05 PM

#### Examples
| Script Run Time | Target Time | Search Window | Result | Notification Timing |
|---|---|---|---|---|
| 1:59 PM | 2:00 PM | 1:55-2:05 PM | Finds 2:00 PM meeting | 1 min early ⚡ |
| 2:00 PM | 2:00 PM | 1:55-2:05 PM | Finds 2:00 PM meeting | Exactly on time 🎯 |
| 2:01 PM | 2:00 PM | 1:55-2:05 PM | Finds 2:00 PM meeting | 1 min late ✅ |
| 2:29 PM | 2:30 PM | 2:25-2:35 PM | Finds 2:30 PM meeting | 1 min early ⚡ |
| 2:30 PM | 2:30 PM | 2:25-2:35 PM | Finds 2:30 PM meeting | Exactly on time 🎯 |
| 2:31 PM | 2:30 PM | 2:25-2:35 PM | Finds 2:30 PM meeting | 1 min late ✅ |

#### Duplicate Prevention
- **Smart targeting**: Each trigger run only looks for meetings near one specific time
- **Non-overlapping windows**: 2:00 PM window (1:55-2:05) never overlaps with 2:30 PM window (2:25-2:35)
- **One notification per meeting**: Each meeting gets exactly one notification

### Alternative: Exact Timing (Advanced)

For notifications sent at **exactly** :00 and :30 times, you would need:

```javascript
// Create trigger at exactly :00, runs every hour at :00
ScriptApp.newTrigger('checkCalendarAndNotify')
  .timeBased()
  .everyHours(1)
  .create();

// Create trigger at exactly :30, runs every hour at :30  
ScriptApp.newTrigger('checkCalendarAndNotify')
  .timeBased()
  .everyHours(1)
  .create();
```

**Challenge**: You must create the first trigger at exactly :00 and the second at exactly :30.

**Recommendation**: The 1-minute approach provides maximum precision, but consider the resource usage if you have many scripts running.

### Google Apps Script Quotas (Every Minute Considerations)

Running every minute uses more resources but is well within Google's limits:

| Resource | Daily Limit | 1-min Usage | 5-min Usage | Status |
|---|---|---|---|---|
| **Script runtime** | 6 hours | ~24 minutes | ~5 minutes | ✅ Safe |
| **Triggers** | 20 per script | 1 trigger | 1 trigger | ✅ Safe |
| **Calendar API calls** | 1,000,000 | ~1,440 calls | ~288 calls | ✅ Safe |
| **URL fetches** | 20,000 | Variable | Variable | ✅ Safe |

**Verdict**: Every minute is perfectly safe for a single meeting notifier script.

### Adjusting Trigger Frequency

To change the frequency, modify line 577 in `setupCalendarTrigger()`:

```javascript
// For maximum precision (30 seconds)
.everyMinutes(1)

// For good balance (2.5 minutes) 
.everyMinutes(5)

// For light usage (7.5 minutes)
.everyMinutes(15)
```

Re-run `setupCalendarTrigger()` after changing to update the trigger.

## Security Notes

- Calendar access is read-only
- Webhook URLs should be kept secure in your `config.js`
- The script only processes events matching your configured prefixes
- All error notifications include timestamps for audit purposes

## Troubleshooting

If notifications aren't working:

1. Check the Google Apps Script execution log
2. Verify calendar permissions
3. Test with debug functions
4. Monitor the error channel for automated alerts
5. Ensure webhook URLs are active and correct

For additional help, check the execution transcript in Google Apps Script for detailed error messages.
