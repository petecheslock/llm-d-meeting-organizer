# LLM-D Meeting File Organizer

**Google Apps Script** solution that automatically organizes Google Meet recordings and sends Slack notifications.

## Features

- Automatically detects files with configured meeting patterns (e.g., `[PUBLIC] llm-d sig-*`)
- Only processes complete pairs: both "Notes by Gemini" and "Recording" files must be present
- Moves files to exact target folders you specify in Google Drive
- Sends Slack notifications to corresponding channels via webhooks
- **Error notifications** - sends alerts to your private channel for any issues
- Runs every 15 minutes automatically
- **Debug mode** - test safely without moving files

## Quick Start

1. **Copy the script**: Go to [script.google.com](https://script.google.com) and create a new project
2. **Paste the code**: Copy all contents from `google-apps-script-solution.js`
3. **Create config**: Add a new file called `config.js` with your folder IDs and webhook URLs (see `config.example.js`)
4. **Test first**: Run `testDebugMode()` to verify configuration without moving files
5. **Run setup**: Execute `setupAutomaticTrigger()` to enable automatic scheduling

📖 **Full setup instructions**: See [GOOGLE_APPS_SCRIPT_SETUP.md](./GOOGLE_APPS_SCRIPT_SETUP.md)

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

- `google-apps-script-solution.js` - Complete Google Apps Script implementation
- `config.example.js` - Configuration template with your actual values
- `config-template.js` - Configuration template showing structure
- `slack-app-manifest.yaml` - Slack app configuration for webhook setup
- `GOOGLE_APPS_SCRIPT_SETUP.md` - Detailed setup instructions
- `README.md` - This overview

## Security & Permissions

The script only requires:
- **Google Drive**: Read/write access to organize files
- **Slack**: Webhook URLs for notifications
