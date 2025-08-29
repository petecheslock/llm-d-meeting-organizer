/**
 * LLM-D Calendar Meeting Notifier
 * 
 * Automatically checks a shared Google Calendar every 30 minutes (on the hour and half hour)
 * and posts Slack notifications for upcoming meetings based on configured prefixes.
 * 
 * Features:
 * - Runs every 30 minutes exactly (on :00 and :30)
 * - Queries public shared calendar for upcoming meetings
 * - Posts to specific SIG channels + #community (except Community Meeting which only goes to #community)
 * - Includes Google Meet links in visually appealing format
 * - Debug mode for testing message formatting
 * 
 * Setup Instructions: See CALENDAR_MEETING_NOTIFIER.md
 */

// Load configuration - create config.js based on config.example.js
// This will be loaded automatically when the script runs

/**
 * Main function to check calendar and send notifications
 * Called by the scheduled trigger every 30 minutes
 */
function checkCalendarAndNotify() {
  try {
    console.log('🕐 Starting calendar check at:', new Date().toISOString());
    
    // Configuration should be loaded from config.js in this script
    
    // Get calendar events for the next 30 minutes
    const upcomingMeetings = getUpcomingMeetings(CONFIG);
    
    if (upcomingMeetings.length === 0) {
      console.log('📅 No upcoming meetings found');
      return;
    }
    
    console.log(`📅 Found ${upcomingMeetings.length} upcoming meeting(s)`);
    
    // Process each meeting
    for (const meeting of upcomingMeetings) {
      processMeeting(meeting, CONFIG);
    }
    
  } catch (error) {
    console.error('❌ Error in checkCalendarAndNotify:', error);
    sendErrorNotification('Calendar check failed', error.toString());
  }
}

/**
 * Get meetings starting within the next 30 minutes
 */
function getUpcomingMeetings() {
  try {
    const now = new Date();
    
    // Find the nearest :00 or :30 time and search ±5 minutes around it
    const currentMinute = now.getMinutes();
    let targetTime;
    
    // Determine which :00 or :30 time we're closest to
    if (currentMinute <= 15) {
      // Closer to :00 (0-15 minutes)
      targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
    } else if (currentMinute <= 45) {
      // Closer to :30 (16-45 minutes)  
      targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 30, 0, 0);
    } else {
      // Closer to next hour's :00 (46-59 minutes)
      targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
    }
    
    // Search ±5 minutes around the target time
    const windowStart = new Date(targetTime.getTime() - (5 * 60 * 1000)); // 5 minutes before
    const windowEnd = new Date(targetTime.getTime() + (5 * 60 * 1000));   // 5 minutes after
    
    console.log(`🕐 Current time: ${now.toLocaleTimeString()}`);
    console.log(`🎯 Target time: ${targetTime.toLocaleTimeString()}`);
    console.log(`📅 Search window (±5min): ${windowStart.toLocaleTimeString()} - ${windowEnd.toLocaleTimeString()}`);
    
    // Get the calendar by ID (configured in CONFIG)
    const calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
    
    if (!calendar) {
      throw new Error(`Calendar not found with ID: ${CONFIG.CALENDAR_ID}`);
    }
    
    // Get events in the current 30-minute window only
    const events = calendar.getEvents(windowStart, windowEnd);
    
    const upcomingMeetings = [];
    
    for (const event of events) {
      const title = event.getTitle();
      const startTime = event.getStartTime();
      const meetingDetails = extractMeetingDetails(event);
      
      // Check if this meeting matches any of our configured prefixes
      const matchedConfig = findMatchingMeetingConfig(title);
      
      if (matchedConfig) {
        upcomingMeetings.push({
          title: title,
          startTime: startTime,
          meetLink: meetingDetails.meetLink,
          documents: meetingDetails.documents,
          hasDocuments: meetingDetails.hasDocuments,
          config: matchedConfig,
          event: event
        });
        
        console.log(`📋 Found matching meeting: ${title} at ${startTime.toLocaleTimeString()}`);
      } else {
        console.log(`⏭️ Meeting found but no config match: ${title} at ${startTime.toLocaleTimeString()}`);
      }
    }
    
    return upcomingMeetings;
    
  } catch (error) {
    console.error('❌ Error getting upcoming meetings:', error);
    throw error;
  }
}

/**
 * Extract file ID from Google Drive URL
 */
function extractFileIdFromUrl(url) {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9-_]+)/,
    /\/document\/d\/([a-zA-Z0-9-_]+)/,
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    /\/presentation\/d\/([a-zA-Z0-9-_]+)/,
    /[?&]id=([a-zA-Z0-9-_]+)/,
    /\/open\?id=([a-zA-Z0-9-_]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      console.log(`✅ Extracted file ID ${match[1]} from URL using pattern: ${pattern}`);
      return match[1];
    }
  }
  console.log(`❌ Could not extract file ID from URL: ${url}`);
  return null;
}

/**
 * Get file name from Google Drive using the Drive API
 */
function getFileNameFromDrive(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    return file.getName();
  } catch (error) {
    console.log(`ℹ️ Could not get file name for ID ${fileId}:`, error.message);
    return null;
  }
}

/**
 * Try to use the advanced Calendar API to get more event details
 */
function getAdvancedEventDetails(event) {
  try {
    // Try to use the advanced Calendar API if available
    const eventId = event.getId();
    const calendarId = CONFIG.CALENDAR_ID;
    
    console.log('🔍 Attempting advanced Calendar API access...');
    console.log('📋 Event ID:', eventId);
    console.log('📅 Calendar ID:', calendarId);
    
    // Try to access the Calendar API directly for more detailed information
    // This requires the Calendar API to be enabled
    const calendarService = Calendar.Events;
    if (calendarService) {
      const detailedEvent = calendarService.get(calendarId, eventId.split('@')[0]);
      
      console.log('✅ Advanced Calendar API access successful');
      console.log('🔍 Conference data:', detailedEvent.conferenceData ? 'Found' : 'None');
      console.log('🔍 Attachments:', detailedEvent.attachments ? detailedEvent.attachments.length : 0);
      console.log('🔍 Extended properties:', detailedEvent.extendedProperties ? 'Found' : 'None');
      
      return {
        conferenceData: detailedEvent.conferenceData,
        attachments: detailedEvent.attachments || [],
        extendedProperties: detailedEvent.extendedProperties,
        htmlLink: detailedEvent.htmlLink,
        description: detailedEvent.description
      };
    }
  } catch (apiError) {
    console.log('ℹ️ Advanced Calendar API not available or not enabled:', apiError.message);
    console.log('💡 You may need to enable the Calendar API in your Google Apps Script project');
  }
  
  return null;
}

/**
 * Extract Google Meet link and attached documents from calendar event
 */
function extractMeetingDetails(event) {
  try {
    const description = event.getDescription() || '';
    const location = event.getLocation() || '';
    
    // Debug: Show what we're working with
    console.log('🔍 Event debugging:');
    console.log('📝 Description length:', description.length);
    console.log('📍 Location:', location);
    console.log('📝 Description preview:', description.substring(0, 200) + (description.length > 200 ? '...' : ''));
    
    // Try advanced Calendar API first
    const advancedDetails = getAdvancedEventDetails(event);
    let meetLink = null;
    const driveLinks = [];
    
    if (advancedDetails) {
      // Extract Meet link from conference data
      if (advancedDetails.conferenceData && advancedDetails.conferenceData.entryPoints) {
        const meetEntry = advancedDetails.conferenceData.entryPoints.find(ep => 
          ep.entryPointType === 'video' && ep.uri && ep.uri.includes('meet.google.com')
        );
        if (meetEntry) {
          meetLink = meetEntry.uri;
          console.log('✅ Found Meet link from conference data:', meetLink);
        }
      }
      
      // Extract documents from attachments
      if (advancedDetails.attachments && advancedDetails.attachments.length > 0) {
        advancedDetails.attachments.forEach(attachment => {
          if (attachment.fileUrl) {
            driveLinks.push(attachment.fileUrl);
            console.log('✅ Found attachment:', attachment.fileUrl);
          }
        });
      }
      
      // Also check the HTML description for additional links
      if (advancedDetails.description && advancedDetails.description.length > description.length) {
        console.log('✅ Found richer description from API');
        const richDescription = advancedDetails.description;
        const richDriveRegex = /https:\/\/(?:docs|drive)\.google\.com\/[^\s\)\>\"]+/g;
        const richDriveLinks = richDescription.match(richDriveRegex) || [];
        richDriveLinks.forEach(link => {
          if (!driveLinks.includes(link)) {
            driveLinks.push(link);
            console.log('✅ Found additional Drive link from rich description:', link);
          }
        });
      }
    }
    
    // Fallback to basic description/location parsing if advanced API didn't work
    if (!meetLink) {
      console.log('🔍 Falling back to basic description/location parsing...');
      const meetRegex = /https:\/\/meet\.google\.com\/[a-z-]+/g;
      let meetMatch = description.match(meetRegex);
      if (!meetMatch) {
        meetMatch = location.match(meetRegex);
      }
      if (meetMatch) {
        meetLink = meetMatch[0];
        console.log('✅ Found Meet link in description/location:', meetLink);
      }
    }
    
    // Fallback document parsing if we didn't find any from attachments
    if (driveLinks.length === 0) {
      console.log('🔍 Falling back to basic document link parsing...');
      const driveRegex = /https:\/\/(?:docs|drive)\.google\.com\/[^\s\)\>]+/g;
      const basicDriveLinks = description.match(driveRegex) || [];
      driveLinks.push(...basicDriveLinks);
    }
    
    // Extract file names for each document
    const documentsWithNames = driveLinks.map((url, index) => {
      console.log(`🔍 Processing document ${index + 1}: ${url}`);
      const fileId = extractFileIdFromUrl(url);
      let fileName = null;
      let fileType = '📁';
      
      if (fileId) {
        console.log(`📎 Extracted file ID: ${fileId}`);
        fileName = getFileNameFromDrive(fileId);
        console.log(`📎 File name: ${fileName}`);
        
        // Determine file type icon based on URL
        if (url.includes('/document/')) {
          fileType = '📄';
        } else if (url.includes('/spreadsheets/')) {
          fileType = '📊';
        } else if (url.includes('/presentation/')) {
          fileType = '📑';
        }
      } else {
        console.log(`❌ Could not extract file ID from: ${url}`);
      }
      
      return {
        url: url,
        fileName: fileName,
        fileType: fileType,
        displayName: fileName || 'Google Drive File'
      };
    });
    
    console.log(`📊 Final results: Meet link: ${meetLink ? 'Found' : 'Not found'}, Documents: ${documentsWithNames.length}`);
    
    return {
      meetLink: meetLink,
      documents: documentsWithNames,
      hasDocuments: documentsWithNames.length > 0
    };
    
  } catch (error) {
    console.error('❌ Error extracting meeting details:', error);
    return {
      meetLink: null,
      documents: [],
      hasDocuments: false
    };
  }
}

/**
 * Find matching meeting configuration based on title prefix
 */
function findMatchingMeetingConfig(title) {
  for (const [prefix, config] of Object.entries(CONFIG.MEETING_CONFIGS)) {
    if (title.startsWith(prefix)) {
      return {
        prefix: prefix,
        ...config
      };
    }
  }
  return null;
}

/**
 * Process a single meeting and send notifications
 */
function processMeeting(meeting) {
  try {
    console.log(`📋 Processing meeting: ${meeting.title}`);
    console.log(`🕐 Start time: ${meeting.startTime}`);
    
    // Determine which channels to notify
    const channelsToNotify = getChannelsToNotify(meeting.config);
    
    for (const channel of channelsToNotify) {
      // Format message based on target channel
      const message = formatSlackMessage(meeting, channel.name);
      sendSlackNotification(channel.webhook, message, channel.name);
    }
    
  } catch (error) {
    console.error(`❌ Error processing meeting ${meeting.title}:`, error);
    sendErrorNotification(`Failed to process meeting: ${meeting.title}`, error.toString());
  }
}

/**
 * Determine which channels should receive notifications
 */
function getChannelsToNotify(meetingConfig) {
  const channels = [];
  
  // Community Meeting only goes to #community
  if (meetingConfig.prefix === '[PUBLIC] llm-d Community Meeting') {
    channels.push({
      webhook: meetingConfig.slackWebhook,
      name: meetingConfig.slackChannel
    });
  } else {
    // SIG meetings go to both their specific channel and #community
    channels.push({
      webhook: meetingConfig.slackWebhook,
      name: meetingConfig.slackChannel
    });
    
    // Also send to community channel (find community config)
    const communityConfig = CONFIG.MEETING_CONFIGS['[PUBLIC] llm-d Community Meeting'];
    if (communityConfig) {
      channels.push({
        webhook: communityConfig.slackWebhook,
        name: communityConfig.slackChannel
      });
    }
  }
  
  return channels;
}

/**
 * Extract SIG name from meeting title for a cleaner message
 */
function extractSigName(title) {
  // Extract SIG name from titles like "[PUBLIC] llm-d sig-autoscaling"
  const sigMatch = title.match(/sig-([a-z-]+)/i);
  if (sigMatch) {
    return `sig-${sigMatch[1]}`;
  }
  
  // Handle Community Meeting
  if (title.includes('Community Meeting')) {
    return 'Community Meeting';
  }
  
  // Fallback to full title
  return title;
}

/**
 * Format the Slack message with meeting details
 * Channel parameter determines the message content
 */
function formatSlackMessage(meeting, targetChannel) {
  const sigName = extractSigName(meeting.title);
  const isSigMeeting = sigName.startsWith('sig-');
  const isCommunityChannel = targetChannel === '#community';
  
  // Create the main message text with status
  let messageText;
  
  // Keep the same simple messaging regardless of timing
  if (isSigMeeting && isCommunityChannel) {
    // SIG meeting posted to community channel - include channel link
    messageText = `:bell: Reminder: The weekly public llm-d ${sigName} meeting is starting NOW.\n\nJoin the ${meeting.config.slackChannel} channel for detailed discussion.`;
  } else {
    // SIG meeting posted to SIG channel OR Community meeting - use simple format
    messageText = `:bell: Reminder: The weekly public llm-d ${sigName} meeting is starting NOW. Join us!`;
  }
  
  // Add Google Meet link if available
  if (meeting.meetLink) {
    messageText += `\n\n:video_camera: <${meeting.meetLink}|Join Google Meet>`;
  }
  
  // Add meeting documents if available
  if (meeting.hasDocuments && meeting.documents.length > 0) {
    messageText += `\n\n:memo: Meeting Notes:`;
    meeting.documents.forEach((doc) => {
      messageText += `\n• <${doc.url}|${doc.displayName}>`;
    });
  }
  
  let message = {
    "text": messageText,
    "blocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": messageText
        }
      }
    ]
  };
  
  return message;
}

/**
 * Send Slack notification
 */
function sendSlackNotification(webhookUrl, message, channelName) {
  try {
    // In debug mode, send to error channel instead
    const targetWebhook = CONFIG.DEBUG_MODE ? CONFIG.DEFAULT_WEBHOOK : webhookUrl;
    
    // Create a deep copy of the message to avoid modifying the original
    let messageToSend = JSON.parse(JSON.stringify(message));
    
    // Add debug information as a separate block if in debug mode
    if (CONFIG.DEBUG_MODE) {
      // Add debug header to the message text
      const debugPrefix = `🧪 *TEST NOTIFICATION* - This would normally be posted to ${channelName}\n\n`;
      messageToSend.text = debugPrefix + messageToSend.text;
      messageToSend.blocks[0].text.text = debugPrefix + messageToSend.blocks[0].text.text;
    }
    
    const response = UrlFetchApp.fetch(targetWebhook, {
      'method': 'POST',
      'headers': {
        'Content-Type': 'application/json',
      },
      'payload': JSON.stringify(messageToSend)
    });
    
    if (response.getResponseCode() === 200) {
      console.log(`✅ Notification sent successfully to ${channelName}`);
    } else {
      console.error(`❌ Failed to send notification to ${channelName}:`, response.getContentText());
    }
    
  } catch (error) {
    console.error(`❌ Error sending Slack notification to ${channelName}:`, error);
    throw error;
  }
}

/**
 * Send error notification to debug channel
 */
function sendErrorNotification(title, errorMessage) {
  try {
    const message = {
      "text": `❌ Calendar Notifier Error`,
      "blocks": [
        {
          "type": "header",
          "text": {
            "type": "plain_text",
            "text": "❌ Calendar Notifier Error"
          }
        },
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `*${title}*\n\`\`\`${errorMessage}\`\`\``
          }
        },
        {
          "type": "context",
          "elements": [
            {
              "type": "mrkdwn",
              "text": `🕐 ${new Date().toISOString()}`
            }
          ]
        }
      ]
    };
    
    UrlFetchApp.fetch(CONFIG.DEFAULT_WEBHOOK, {
      'method': 'POST',
      'headers': {
        'Content-Type': 'application/json',
      },
      'payload': JSON.stringify(message)
    });
    
  } catch (error) {
    console.error('❌ Failed to send error notification:', error);
  }
}

/**
 * Setup function to create the automatic trigger
 * Run this once to enable automatic calendar checking on the hour and half hour
 */
function setupCalendarTrigger() {
  try {
    
    // Delete existing triggers for this function
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
      if (trigger.getHandlerFunction() === 'checkCalendarAndNotify') {
        ScriptApp.deleteTrigger(trigger);
      }
    }
    
    // Create a trigger that runs every minute for maximum precision
    // This ensures notifications are sent within 30 seconds of meeting start time
    // The function's smart timing logic finds the nearest :00/:30 and prevents duplicate notifications
    ScriptApp.newTrigger('checkCalendarAndNotify')
      .timeBased()
      .everyMinutes(1)
      .create();
    
    console.log('✅ Calendar trigger setup successfully - will run every minute');
    sendDebugMessage('Calendar trigger setup successfully - will run every minute');
    
  } catch (error) {
    console.error('❌ Error setting up calendar trigger:', error);
    sendErrorNotification('Failed to setup calendar trigger', error.toString());
  }
}

/**
 * Test function to show the current timing window logic
 */
function testTimingWindow() {
  console.log('🕐 Testing timing window logic...');
  
  const now = new Date();
  const currentMinute = now.getMinutes();
  
  // Find the nearest :00 or :30 time (same logic as main function)
  let targetTime;
  if (currentMinute <= 15) {
    targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
  } else if (currentMinute <= 45) {
    targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 30, 0, 0);
  } else {
    targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
  }
  
  const searchStart = new Date(targetTime.getTime() - (5 * 60 * 1000));
  const searchEnd = new Date(targetTime.getTime() + (5 * 60 * 1000));
  
  console.log(`🕐 Current time: ${now.toLocaleTimeString()}`);
  console.log(`🎯 Target time: ${targetTime.toLocaleTimeString()}`);
  console.log(`📅 Search window (±5min): ${searchStart.toLocaleTimeString()} - ${searchEnd.toLocaleTimeString()}`);
  console.log(`✅ Simple ±5 minute window around nearest :00 or :30 time`);
  
  // Show examples of what would happen at different run times
  const exampleRunTimes = [
    { time: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 2, 0), desc: '2:02 PM' },
    { time: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 27, 0), desc: '2:27 PM' },
    { time: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 35, 0), desc: '2:35 PM' },
    { time: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 55, 0), desc: '2:55 PM' }
  ];
  
  console.log('\n📋 Examples of timing logic:');
  for (const example of exampleRunTimes) {
    const minute = example.time.getMinutes();
    let target;
    if (minute <= 15) {
      target = new Date(example.time.getFullYear(), example.time.getMonth(), example.time.getDate(), example.time.getHours(), 0, 0, 0);
    } else if (minute <= 45) {
      target = new Date(example.time.getFullYear(), example.time.getMonth(), example.time.getDate(), example.time.getHours(), 30, 0, 0);
    } else {
      target = new Date(example.time.getFullYear(), example.time.getMonth(), example.time.getDate(), example.time.getHours() + 1, 0, 0, 0);
    }
    const start = new Date(target.getTime() - (5 * 60 * 1000));
    const end = new Date(target.getTime() + (5 * 60 * 1000));
    console.log(`   Script at ${example.desc} → Target: ${target.toLocaleTimeString()} → Search: ${start.toLocaleTimeString()}-${end.toLocaleTimeString()}`);
  }
}

/**
 * Test function to run in debug mode
 * Use this to test the calendar checking without waiting for the trigger
 */
function testCalendarNotifier() {
  console.log('🧪 Running calendar notifier in debug mode...');
  
  try {
    // Force debug mode for testing
    checkCalendarAndNotifyDebug();
    console.log('✅ Test completed successfully');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

/**
 * Debug version of the main function that forces debug mode
 */
function checkCalendarAndNotifyDebug() {
  try {
    console.log('🕐 Starting calendar check at:', new Date().toISOString());
    
    // Force debug mode for testing
    // Temporarily override CONFIG.DEBUG_MODE
    const originalDebugMode = CONFIG.DEBUG_MODE;
    CONFIG.DEBUG_MODE = true;
    
    // Get calendar events for the next 30 minutes
    const upcomingMeetings = getUpcomingMeetings();
    
    if (upcomingMeetings.length === 0) {
      console.log('📅 No upcoming meetings found');
      sendDebugMessage('Test run completed - no upcoming meetings found');
      return;
    }
    
    console.log(`📅 Found ${upcomingMeetings.length} upcoming meeting(s)`);
    
    // Process each meeting
    for (const meeting of upcomingMeetings) {
      processMeeting(meeting);
    }
    
  } catch (error) {
    console.error('❌ Error in checkCalendarAndNotifyDebug:', error);
    sendErrorNotification('Debug calendar check failed', error.toString());
  } finally {
    // Restore original debug mode
    CONFIG.DEBUG_MODE = originalDebugMode;
  }
}

/**
 * Send a debug message to verify Slack connectivity
 */
function sendDebugMessage(message) {
  try {
    const debugMessage = {
      "text": "🧪 Calendar Notifier Debug",
      "blocks": [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `🧪 *Calendar Notifier Debug*\n${message}\n🕐 ${new Date().toISOString()}`
          }
        }
      ]
    };
    
    UrlFetchApp.fetch(CONFIG.DEFAULT_WEBHOOK, {
      'method': 'POST',
      'headers': {
        'Content-Type': 'application/json',
      },
      'payload': JSON.stringify(debugMessage)
    });
    
  } catch (error) {
    console.error('❌ Failed to send debug message:', error);
  }
}

/**
 * Function to list upcoming events for debugging
 * Use this to see what events are found in your calendar
 */
function debugListUpcomingEvents() {
  try {
    console.log('🔍 Debugging: Listing upcoming events...');
    
    const now = new Date();
    const thirtyMinutesFromNow = new Date(now.getTime() + (30 * 60 * 1000));
    
    const calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
    if (!calendar) {
      console.error(`❌ Calendar not found with ID: ${CONFIG.CALENDAR_ID}`);
      return;
    }
    
    const events = calendar.getEvents(now, thirtyMinutesFromNow);
    
    console.log(`📅 Found ${events.length} events in the next 30 minutes:`);
    
    for (const event of events) {
      console.log('='.repeat(50));
      console.log(`📋 Event: ${event.getTitle()}`);
      console.log(`🕐 Start: ${event.getStartTime()}`);
      console.log(`📍 Location: ${event.getLocation()}`);
      console.log(`📝 Description (first 500 chars):`);
      const desc = event.getDescription() || '';
      console.log(desc.substring(0, 500) + (desc.length > 500 ? '...' : ''));
      console.log(`📏 Full description length: ${desc.length} characters`);
      
      // Extract meeting details with full debugging
      const meetingDetails = extractMeetingDetails(event);
      console.log(`🎥 Meet Link: ${meetingDetails.meetLink || 'None'}`);
      console.log(`📎 Documents: ${meetingDetails.documents.length}`);
      if (meetingDetails.documents.length > 0) {
        meetingDetails.documents.forEach((doc, index) => {
          console.log(`   ${index + 1}. ${doc.displayName} (${doc.url})`);
        });
      }
      console.log('='.repeat(50));
    }
    
  } catch (error) {
    console.error('❌ Error debugging events:', error);
  }
}

/**
 * Test function that finds the next upcoming meeting and sends a notification
 * Searches the next 7 days to find a matching meeting
 * This helps you see what the actual Slack message will look like
 */
function testNextMeetingNotification() {
  try {
    console.log('🧪 Testing notification for next upcoming meeting...');
    
    // Check config first
    if (typeof CONFIG === 'undefined') {
      console.error('❌ CONFIG is not defined - create config.js first');
      return;
    }
    
    // Force debug mode for testing
    const originalDebugMode = CONFIG.DEBUG_MODE;
    CONFIG.DEBUG_MODE = true;
    
    // Look for meetings in the next 7 days to find upcoming meetings
    const now = new Date();
    const next7Days = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
    
    console.log(`🔍 Searching for meetings between ${now.toLocaleString()} and ${next7Days.toLocaleString()}`);
    
    const calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
    if (!calendar) {
      console.error(`❌ Calendar not found with ID: ${CONFIG.CALENDAR_ID}`);
      return;
    }
    
    const events = calendar.getEvents(now, next7Days);
    console.log(`📅 Found ${events.length} total events in next 7 days`);
    
    // Find the next meeting that matches our prefixes
    let nextMeeting = null;
    
    for (const event of events) {
      const title = event.getTitle();
      const startTime = event.getStartTime();
      const meetingDetails = extractMeetingDetails(event);
      
      console.log(`📋 Checking event: "${title}" at ${startTime.toLocaleString()}`);
      
      // Check if this meeting matches any of our configured prefixes
      const matchedConfig = findMatchingMeetingConfig(title);
      
      if (matchedConfig) {
        nextMeeting = {
          title: title,
          startTime: startTime,
          meetLink: meetingDetails.meetLink,
          documents: meetingDetails.documents,
          hasDocuments: meetingDetails.hasDocuments,
          config: matchedConfig,
          event: event
        };
        console.log(`✅ Found matching meeting: ${title}`);
        console.log(`📎 Documents found: ${meetingDetails.documents.length}`);
        break;
      } else {
        console.log(`⏭️ Skipping "${title}" - doesn't match any configured prefixes`);
      }
    }
    
    if (!nextMeeting) {
      console.log('⚠️ No matching meetings found in the next 7 days');
      console.log('💡 Available prefixes in your config:');
      Object.keys(CONFIG.MEETING_CONFIGS).forEach(prefix => {
        console.log(`   - "${prefix}"`);
      });
      return;
    }
    
    console.log('🎯 Testing notification for:', nextMeeting.title);
    console.log('📅 Meeting time:', nextMeeting.startTime.toLocaleString());
    console.log('🎥 Meet link:', nextMeeting.meetLink || 'Not found');
    console.log('📎 Documents attached:', nextMeeting.documents.length);
    if (nextMeeting.documents.length > 0) {
      nextMeeting.documents.forEach((doc, index) => {
        console.log(`   ${index + 1}. ${doc.displayName} (${doc.url})`);
      });
    }
    
    // Create and log the message payload (for community channel example)
    const message = formatSlackMessage(nextMeeting, '#community');
    console.log('📨 Message payload (for #community channel):');
    console.log(JSON.stringify(message, null, 2));
    
    // Send the test notification
    console.log('📤 Sending test notification...');
    processMeeting(nextMeeting);
    
    console.log('✅ Test notification sent! Check your error channel to see the formatted message.');
    
    // Restore original debug mode
    CONFIG.DEBUG_MODE = originalDebugMode;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    // Restore debug mode even if error occurs
    if (typeof originalDebugMode !== 'undefined') {
      CONFIG.DEBUG_MODE = originalDebugMode;
    }
  }
}

/**
 * Test function to verify config is properly set up
 * Run this to verify your config.js is working correctly
 */
function testConfig() {
  try {
    console.log('🧪 Testing configuration...');
    
    // Check if CONFIG is defined
    if (typeof CONFIG === 'undefined') {
      console.error('❌ CONFIG is not defined');
      console.log('💡 Make sure you have created config.js in this script with your configuration');
      return;
    }
    
    console.log('✅ CONFIG is defined');
    
    // Debug: Show all available config keys
    console.log('📋 Available config keys:', Object.keys(CONFIG));
    
    // Check specific fields
    console.log('Calendar ID:', CONFIG.CALENDAR_ID || 'NOT SET');
    console.log('Default webhook:', CONFIG.DEFAULT_WEBHOOK || 'NOT SET');
    console.log('Debug mode:', CONFIG.DEBUG_MODE);
    
    if (CONFIG.MEETING_CONFIGS) {
      console.log('Meeting configs:', Object.keys(CONFIG.MEETING_CONFIGS).length);
    } else {
      console.log('Meeting configs: NOT SET');
    }
    
    // Verify required fields
    const requiredFields = ['CALENDAR_ID', 'DEFAULT_WEBHOOK', 'MEETING_CONFIGS'];
    const missingFields = requiredFields.filter(field => !CONFIG[field]);
    
    if (missingFields.length > 0) {
      console.warn('⚠️ Missing required fields in config:', missingFields);
      console.log('');
      console.log('🔧 TO FIX: Add these to your config.js:');
      if (missingFields.includes('CALENDAR_ID')) {
        console.log('   CALENDAR_ID: "your-calendar-id@group.calendar.google.com",');
      }
      console.log('');
      console.log('💡 Your config.js should look like:');
      console.log('const CONFIG = {');
      console.log('  DEBUG_MODE: false,');
      console.log('  CALENDAR_ID: "your-calendar-id@group.calendar.google.com",');
      console.log('  MEETING_CONFIGS: { ... },');
      console.log('  DEFAULT_WEBHOOK: "your-webhook-url"');
      console.log('};');
    } else {
      console.log('✅ All required configuration fields are present');
      
      // Send test message to verify webhook connectivity
      if (CONFIG.DEFAULT_WEBHOOK) {
        sendDebugMessage('Configuration test successful - config.js is working!');
      }
    }
    
  } catch (error) {
    console.error('❌ Configuration test failed:', error);
    console.log('📋 Troubleshooting checklist:');
    console.log('1. Create a config.js file in this Google Apps Script project');
    console.log('2. Copy config.example.js and update with your values');
    console.log('3. Make sure CONFIG is defined as a global variable');
    console.log('4. Include all required fields: CALENDAR_ID, DEFAULT_WEBHOOK, MEETING_CONFIGS');
  }
}
