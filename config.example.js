/**
 * Configuration Template for LLM-D Meeting File Organizer
 * 
 * Copy this file to config.js and update with your actual values.
 * The config.js file is excluded from Git to keep your secrets safe.
 */

const CONFIG = {
  // DEBUG MODE - Set to true to test without actually moving files
  DEBUG_MODE: false,
  
  // Source folder ID where meeting recordings are stored (your "meet recordings" folder)
  // Get this from the URL: https://drive.google.com/drive/folders/YOUR_SOURCE_FOLDER_ID_HERE
  SOURCE_FOLDER_ID: 'YOUR_SOURCE_FOLDER_ID_HERE',
  
  // Calendar ID for the shared calendar to monitor for upcoming meetings (calendar notifier only)
  // Get this from Google Calendar settings -> Calendar settings -> Calendar ID
  // For public calendars, it's usually the email address format
  CALENDAR_ID: 'YOUR_CALENDAR_ID_HERE@group.calendar.google.com',
  
  // Meeting prefix to exact target folder mapping
  // Each entry maps a meeting prefix to the exact Google Drive folder ID where files should be moved
  MEETING_CONFIGS: {
    '[PUBLIC] llm-d sig-autoscaling': {
      targetFolderId: 'YOUR_TARGET_FOLDER_ID',
      slackWebhook: 'YOUR_SLACK_WEBHOOK_URL',
      slackChannel: '#sig-autoscaling'
    },
    '[PUBLIC] llm-d sig-benchmarking': {
      targetFolderId: 'YOUR_TARGET_FOLDER_ID',
      slackWebhook: 'YOUR_SLACK_WEBHOOK_URL',
      slackChannel: '#sig-benchmarking'
    },
    '[PUBLIC] sig-inference-scheduler': {
      targetFolderId: 'YOUR_TARGET_FOLDER_ID',
      slackWebhook: 'YOUR_SLACK_WEBHOOK_URL',
      slackChannel: '#sig-inference-scheduler'
    },
    '[PUBLIC] llm-d sig-installation': {
      targetFolderId: 'YOUR_TARGET_FOLDER_ID',
      slackWebhook: 'YOUR_SLACK_WEBHOOK_URL',
      slackChannel: '#sig-installation'
    },
    '[PUBLIC] llm-d sig-kv-disaggregation': {
      targetFolderId: 'YOUR_TARGET_FOLDER_ID',
      slackWebhook: 'YOUR_SLACK_WEBHOOK_URL',
      slackChannel: '#sig-kv-disaggregation'
    },
    '[PUBLIC] llm-d sig-observability': {
      targetFolderId: 'YOUR_TARGET_FOLDER_ID',
      slackWebhook: 'YOUR_SLACK_WEBHOOK_URL',
      slackChannel: '#sig-observability'
    },
    '[PUBLIC] llm-d sig-pd-disaggregation': {
      targetFolderId: 'YOUR_TARGET_FOLDER_ID',
      slackWebhook: 'YOUR_SLACK_WEBHOOK_URL',
      slackChannel: '#sig-pd-disaggregation'
    },
    '[PUBLIC] llm-d Community Meeting': {
      targetFolderId: 'YOUR_TARGET_FOLDER_ID',
      slackWebhook: 'YOUR_SLACK_WEBHOOK_URL',
      slackChannel: '#community'
    }
    // Add more meeting configurations as needed
    // Format: 'meeting prefix': { targetFolderId, slackWebhook, slackChannel }
  },
  
  // Default webhook for error notifications and debug testing
  // This is used for both file organizer and calendar notifier errors
  DEFAULT_WEBHOOK: 'YOUR_DEFAULT_WEBHOOK_URL'
};
