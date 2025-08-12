# Google Apps Script Setup Guide

## Overview

The Google Apps Script will:
1. **Scan** your specified source folder for meeting recordings
2. **Match** files with configured meeting prefixes (like `[PUBLIC] llm-d sig-autoscaling` or `[PUBLIC] llm-d Community Meeting`)
3. **Upload** recordings to YouTube (optional, configurable per meeting type)
4. **Move** them to exact target folders you specify (no searching required)
5. **Send** Slack notifications via webhooks to corresponding channels
6. **Run automatically** every 15 minutes

## Prerequisites

- Google Workspace account with Drive access
- Slack workspace with webhook permissions
- Shared Google Drive folder for organizing files
- **YouTube channel** (optional, for automatic video uploads)

## Setup Instructions

### Step 1: Identify Your Folders

You need to get the Google Drive folder IDs for:

1. **Source folder** - Your "meet recordings" folder where new recordings appear
2. **Target folders** - Exact folders where you want different meeting types moved

To get folder IDs:
1. Open the folder in Google Drive
2. Copy the ID from the URL: `https://drive.google.com/drive/folders/17p-bGjhOPBXoEljHiDURRzwQ2ieYuizj`
3. The folder ID is the part after `/folders/`

**Example:**
- Source folder: `1ABC123def456ghi789` (your "meet recordings" folder)
- sig-autoscaling target: `17p-bGjhOPBXoEljHiDURRzwQ2ieYuizj` ("Meeting Recordings & Transcripts" folder)
- Community meeting target: `2XYZ789abc123def456` (community meeting folder)

### Step 2: Setup Slack Webhooks

For each meeting type you want to notify:

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create a new app: "LLM-D Meeting Organizer"
3. Enable "Incoming Webhooks"
4. Add webhook for each channel:
   - Click "Add New Webhook to Workspace"
   - Select channel (e.g., `#sig-autoscaling` or `#community`)
   - Copy the webhook URL
5. Repeat for each meeting type

**Example webhook URLs:**
```
sig-autoscaling: https://hooks.slack.com/services/T123/B456/xyz789
community: https://hooks.slack.com/services/T123/B456/abc123
```

### Step 3: Setup YouTube API (Optional)

**Skip this step if you don't want automatic YouTube uploads.**

#### 3.1: Enable YouTube Advanced Service in Apps Script

1. In your Google Apps Script project, click on "Services" (+ icon) in the left sidebar
2. Find "YouTube Data API" and click "Add"
3. Keep the default identifier "YouTube"
4. The YouTube Advanced Service will handle authentication automatically

#### 3.2: Get YouTube Channel and Playlist IDs

1. **Channel ID**: Go to your YouTube channel → About tab → copy Channel ID
2. **Playlist ID**: 
   - Create a playlist for your meeting videos
   - Go to the playlist → copy ID from URL: `https://www.youtube.com/playlist?list=PLxxxxxxxxxxxxxx`
   - The playlist ID is the part after `list=`

### Step 4: Create Google Apps Script

1. Go to [script.google.com](https://script.google.com)
2. Click "New Project"
3. Name it: "LLM-D Meeting File Organizer"
4. Delete the default `myFunction()` code
5. Copy and paste the entire contents of `google-apps-script-solution.js`

### Step 5: Configure the Script

Update the `CONFIG` section in `config.example.js` and save as `config.js` in your project.

```javascript
const CONFIG = {
  // Your source folder ID from Step 1 (where recordings appear)
  SOURCE_FOLDER_ID: '1ABC123def456ghi789',
  
  // Meeting prefix to exact target folder mapping
  MEETING_CONFIGS: {
    '[PUBLIC] llm-d sig-autoscaling': {
      targetFolderId: '17p-bGjhOPBXoEljHiDURRzwQ2ieYuizj',
      slackWebhook: 'https://hooks.slack.com/services/T123/B456/xyz789',
      slackChannel: '#sig-autoscaling'
      // No YouTube upload for this meeting type
    },
    '[PUBLIC] llm-d Community Meeting': {
      targetFolderId: '2XYZ789abc123def456',
      slackWebhook: 'https://hooks.slack.com/services/T123/B456/abc123',
      slackChannel: '#community',
      // YouTube upload configuration (optional)
      youtubeChannelId: 'UCxxxxxxxxxxxxxxx',
      youtubePlaylistId: 'PLxxxxxxxxxxxxxxx',
      uploadToYoutube: true
    }
  },
  
  // Optional: Default webhook for error notifications
  DEFAULT_WEBHOOK: 'https://hooks.slack.com/services/YOUR/DEFAULT/WEBHOOK'
};
```

**Configuration Notes:**
- Replace folder IDs with your actual Google Drive folder IDs
- Replace webhook URLs with your actual Slack webhook URLs
- Add more meeting configurations as needed
- Each meeting prefix gets moved to its exact target folder - no subfolder creation
- **YouTube upload is optional** - only configure for meetings you want automatically uploaded
- YouTube uploads happen **before** file movement for safety

### Step 6: Enable Required APIs

1. In the Apps Script editor, click on "Services" (+ icon) in the left sidebar
2. Find "Drive API" and click "Add"
3. Keep the default identifier "Drive"
4. **If YouTube uploads are enabled**: Also add "YouTube Data API" (should already be added from Step 3.1)

### Step 7: Test YouTube Authorization (If Enabled)

**If you have any meetings configured with `uploadToYoutube: true`, complete this step first:**

1. **Authorize YouTube Access**:
   - Select `testYouTubeAuthorization` from the function dropdown
   - Click the ▶️ "Run" button
   - When prompted, grant YouTube permissions:
     - Click "Review permissions"
     - Choose your Google account
     - Click "Advanced" → "Go to LLM-D Meeting File Organizer (unsafe)"
     - Click "Allow"
     - **Important**: Make sure to grant YouTube permissions when asked
2. Check the execution logs - you should see "✅ YouTube authorization successful!"
3. **This step establishes the OAuth connection for YouTube uploads**

### Step 8: Test the Script (Debug Mode)

1. Save the script (Ctrl+S or Cmd+S)
2. **Test in debug mode** - Run the `testDebugMode` function:
   - Select `testDebugMode` from the function dropdown
   - Click the ▶️ "Run" button
3. Grant remaining permissions when prompted (if you haven't already):
   - Click "Review permissions"
   - Choose your Google account
   - Click "Advanced" → "Go to LLM-D Meeting File Organizer (unsafe)"
   - Click "Allow"
4. Check the execution logs and your DEFAULT_WEBHOOK Slack channel:
   - Debug mode will log all operations without moving files or uploading to YouTube
   - Test notifications will be sent to your DEFAULT_WEBHOOK channel
   - Verify that files are detected and configurations are correct
   - YouTube uploads will be logged but not executed in debug mode

### Step 9: Test Production Mode

1. **After debug mode testing passes**, test with real file movement:
   - Ensure `DEBUG_MODE: false` in your CONFIG object
   - Create a small test file in your source folder with a matching meeting prefix
   - Run the `testFileOrganization` function:
     - Select `testFileOrganization` from the function dropdown
     - Click the ▶️ "Run" button
2. Verify the test file is actually moved to the correct target folder
3. Check that the real Slack notification is sent to the correct channel
4. **If YouTube upload is enabled**: Verify the recording was uploaded to YouTube and added to the playlist

### Step 10: Setup Automatic Scheduling (Cron Job Equivalent)

1. **Only after successful production testing**, set up automation:
   - Run the `setupAutomaticTrigger` function:
     - Select `setupAutomaticTrigger` from the function dropdown
     - Click the ▶️ "Run" button
2. This creates a time-based trigger that runs `organizeMeetingFiles` every 15 minutes
3. This trigger acts as your "cron job" for automatic file organization

### Step 11: Verify Complete Setup

1. Wait 15 minutes for the automatic trigger to run, or manually run `organizeMeetingFiles`
2. Check the execution logs in "Executions" tab to see recent runs
3. Monitor that files are being processed automatically
4. Verify Slack notifications are working for real meetings
5. **If YouTube is enabled**: Check that recordings are uploaded and playlists updated
6. Monitor your DEFAULT_WEBHOOK for any error notifications
7. Note: Files are only processed when both "Notes by Gemini" and "Recording" files are present

## Management & Monitoring

### View Execution Logs

1. In Apps Script editor, click "Executions" in left sidebar
2. See recent runs, execution time, and any errors

### View Active Triggers

1. Run the `listTriggers` function to see current scheduled triggers
2. Or go to "Triggers" in the left sidebar

### Update Webhook URLs

1. Edit the `CONFIG.SLACK_WEBHOOKS` object in the script
2. Save the script - changes take effect immediately

### Add New Meeting Types

1. Create new Slack webhook for the channel
2. Add new entry to `CONFIG.MEETING_CONFIGS` with:
   - Meeting prefix (e.g., `'[PUBLIC] llm-d sig-newtype'`)
   - Target folder ID
   - Slack webhook URL
   - Slack channel name
3. Save the script

## Troubleshooting

### Common Issues

**Files not being found:**
- Verify files are in your configured SOURCE_FOLDER_ID
- Verify file names match exactly the prefixes in MEETING_CONFIGS
- Make sure files aren't in trash
- Check that your Google account can access the source folder

**Slack notifications not working:**
- Verify webhook URLs are correct
- Test webhooks manually using curl or Postman
- Check that channels exist and webhooks are active

**Permission errors:**
- Re-run authorization flow if permissions change
- Make sure the script has access to your Google Drive

**Script not running automatically:**
- Check "Triggers" in Apps Script to ensure trigger exists
- Run `setupAutomaticTrigger` again if needed
- Check execution logs for errors

**YouTube upload issues:**
- Verify YouTube Data API is enabled in Apps Script Services
- Ensure you have permission to upload to the specified channel
- Verify channel ID and playlist ID are correct
- Check DEFAULT_WEBHOOK for specific YouTube error messages
- YouTube uploads are rate-limited - large files may take time
- Files are marked as "uploaded" to prevent duplicates

### Testing Individual Components

**Test file finding:**
```javascript
function testFindFiles() {
  const files = findMeetingFiles();
  console.log(`Found ${files.length} files:`, files.map(f => f.title));
}
```

**Test Slack notification:**
```javascript
function testSlackNotification() {
  const testFiles = [{
    title: 'Test File.mp4',
    webViewLink: 'https://drive.google.com/file/d/test'
  }];
  const config = CONFIG.MEETING_CONFIGS['[PUBLIC] llm-d sig-autoscaling'];
  sendConfiguredSlackNotification('[PUBLIC] llm-d sig-autoscaling', config, testFiles);
}
```