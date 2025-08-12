/**
 * LLM-D Meeting File Organizer - Google Apps Script Version
 * 
 * This script automatically:
 * 1. Finds files matching "[PUBLIC] llm-d sig-*" pattern
 * 2. Moves them to organized folders in a shared drive
 * 3. Sends Slack notifications via webhooks
 * 4. Runs automatically every 15 minutes
 */

// CONFIGURATION is loaded from config.js file
// This keeps sensitive data (webhooks, folder IDs) out of the main script
// Note: In Google Apps Script, upload both this file and config.js

/**
 * Main function that organizes meeting files
 * This gets called by the time-based trigger
 */
function organizeMeetingFiles() {
  try {
    if (CONFIG.DEBUG_MODE) {
      console.log('🐛 DEBUG MODE ENABLED - No files will be moved, operations will be logged only');
    }
    console.log('Starting meeting file organization...');
    
    // Find all meeting files in source folder
    const files = findMeetingFiles();
    console.log(`Found ${files.length} meeting files`);
    
    if (CONFIG.DEBUG_MODE) {
      console.log(`🐛 DEBUG: Source folder ID: ${CONFIG.SOURCE_FOLDER_ID}`);
      files.forEach((file, index) => {
        console.log(`🐛 DEBUG: [${index + 1}/${files.length}] Found file: ${file.title}`);
      });
    }
    
    if (files.length === 0) {
      console.log('No files to process');
      if (CONFIG.DEBUG_MODE) {
        console.log(`🐛 DEBUG: No files found matching any configured meeting prefixes`);
      }
      return;
    }
    
    // Group files by meeting configuration
    const groupedFiles = groupFilesByMeetingConfig(files);
    
    if (CONFIG.DEBUG_MODE) {
      console.log(`🐛 DEBUG: Grouped files into ${Object.keys(groupedFiles).length} meeting configurations`);
      for (const [configKey, groupData] of Object.entries(groupedFiles)) {
        console.log(`🐛 DEBUG: - "${configKey}": ${groupData.files.length} files`);
      }
    }
    
    // Process each meeting group
    for (const [configKey, groupData] of Object.entries(groupedFiles)) {
      const { config, files: groupFiles, isChat } = groupData;
      console.log(`Processing ${groupFiles.length} files for "${configKey}"`);
      
      // Get target folder (create subfolder if needed)
      const targetFolder = getTargetFolder(config);
      
      let filesToNotify = groupFiles;
      
      // Upload recording to YouTube BEFORE moving files
      let youtubeUploadSuccess = true;
      if (config.uploadToYoutube && hasYouTubeConfig()) {
        const recordingFiles = groupFiles.filter(file => file.title.includes('Recording'));
        if (recordingFiles.length > 0) {
          if (CONFIG.DEBUG_MODE) {
            console.log(`🐛 DEBUG: Would upload ${recordingFiles.length} recording(s) to YouTube for "${configKey}"`);
            recordingFiles.forEach(file => {
              console.log(`🐛 DEBUG: Would upload: ${file.title}`);
            });
          } else {
            try {
              youtubeUploadSuccess = uploadVideosToYoutube(recordingFiles, config);
            } catch (error) {
              console.error(`YouTube upload failed for "${configKey}":`, error);
              sendErrorNotification(`YouTube upload failed for "${configKey}": ${error.toString()}`);
              youtubeUploadSuccess = false;
            }
          }
        }
      }
      
      // Only proceed with file movement if YouTube upload succeeded (or wasn't attempted)
      if (!youtubeUploadSuccess) {
        console.log(`Skipping file movement for "${configKey}" due to YouTube upload failure`);
        continue;
      }
      
      // Move files to the folder (or log in debug mode)
      if (CONFIG.DEBUG_MODE) {
        logFileMoveOperations(groupFiles, targetFolder, configKey);
      } else {
        moveFilesToFolder(groupFiles, targetFolder);
        // After moving, get updated file links for the notification
        filesToNotify = groupFiles.map(fileData => {
          const file = DriveApp.getFileById(fileData.id);
          return {
            ...fileData,
            webViewLink: file.getUrl()
          };
        });
      }
      
      // Send Slack notification only for non-Chat files
      if (!isChat) {
        if (CONFIG.DEBUG_MODE) {
          sendDebugSlackNotification(configKey, config, filesToNotify);
        } else {
          sendConfiguredSlackNotification(configKey, config, filesToNotify);
        }
      } else {
        console.log(`Skipping Slack notification for Chat files: "${configKey}"`);
      }
      
      console.log(`Completed processing for "${configKey}"`);
    }
    
    console.log('Meeting file organization completed successfully');
  } catch (error) {
    console.error('Error organizing meeting files:', error);
    
    // Send error notification to monitoring channel
    sendErrorNotification(`Main script error: ${error.toString()}`)
    
    throw error;
  }
}

/**
 * Find all files in the source folder that match configured meeting patterns
 */
function findMeetingFiles() {
  const files = [];
  const sourceFolder = DriveApp.getFolderById(CONFIG.SOURCE_FOLDER_ID);
  const allFiles = sourceFolder.getFiles();
  
  while (allFiles.hasNext()) {
    const file = allFiles.next();
    const fileName = file.getName();
    
    // Check if file matches any configured meeting prefix
    const matchingConfig = findMatchingConfig(fileName);
    if (matchingConfig) {
      files.push({
        id: file.getId(),
        title: fileName,
        webViewLink: file.getUrl(),
        mimeType: file.getBlob().getContentType()
      });
    }
  }
  
  return files;
}


/**
 * Find matching configuration for a file title
 */
function findMatchingConfig(title) {
  for (const [prefix, config] of Object.entries(CONFIG.MEETING_CONFIGS)) {
    if (title.includes(prefix)) {
      return { prefix, config, isChat: title.includes('Chat') };
    }
  }
  return null;
}

/**
 * Group files by their meeting configuration, handling Chat files separately
 */
function groupFilesByMeetingConfig(files) {
  const grouped = {};
  const chatFiles = {};
  
  files.forEach(file => {
    const match = findMatchingConfig(file.title);
    if (match) {
      const { prefix, config, isChat } = match;
      
      if (isChat) {
        // Handle Chat files separately - they don't need pairs
        if (!chatFiles[prefix]) {
          chatFiles[prefix] = {
            config,
            files: [],
            isChat: true
          };
        }
        chatFiles[prefix].files.push(file);
      } else {
        // Handle regular files that need pairs
        if (!grouped[prefix]) {
          grouped[prefix] = {
            config,
            files: []
          };
        }
        grouped[prefix].files.push(file);
      }
    }
  });
  
  // Filter out groups that don't have both "Notes by Gemini" and "Recording" files
  const completeGroups = {};
  for (const [prefix, groupData] of Object.entries(grouped)) {
    const hasNotes = groupData.files.some(file => file.title.includes('Notes by Gemini'));
    const hasRecording = groupData.files.some(file => file.title.includes('Recording'));
    
    if (hasNotes && hasRecording) {
      completeGroups[prefix] = groupData;
      console.log(`Complete pair found for "${prefix}": ${groupData.files.length} files`);
    } else {
      console.log(`Incomplete pair for "${prefix}" - Notes: ${hasNotes}, Recording: ${hasRecording} - skipping until both are available`);
    }
  }
  
  // Add all Chat files to complete groups (they don't need pairs)
  for (const [prefix, chatData] of Object.entries(chatFiles)) {
    console.log(`Chat files found for "${prefix}": ${chatData.files.length} files`);
    completeGroups[prefix + '_chat'] = chatData;
  }
  
  return completeGroups;
}

/**
 * Get target folder from exact folder ID
 */
function getTargetFolder(config) {
  return DriveApp.getFolderById(config.targetFolderId);
}


/**
 * Log file move operations without actually moving files (debug mode)
 */
function logFileMoveOperations(files, folder, configKey) {
  console.log(`🐛 DEBUG: Would move ${files.length} files for "${configKey}"`);
  console.log(`🐛 DEBUG: Target folder ID: ${folder.getId()}`);
  
  files.forEach((fileData, index) => {
    console.log(`🐛 DEBUG: [${index + 1}/${files.length}] Would move file: ${fileData.title}`);
    console.log(`🐛 DEBUG:   - File ID: ${fileData.id}`);
  });
}

/**
 * Move files to the specified folder
 */
function moveFilesToFolder(files, folder) {
  files.forEach(fileData => {
    try {
      const file = DriveApp.getFileById(fileData.id);
      
      // Remove from all current parents
      const parents = file.getParents();
      while (parents.hasNext()) {
        const parent = parents.next();
        parent.removeFile(file);
      }
      
      // Add to new folder
      folder.addFile(file);
      
      console.log(`Moved file: ${fileData.title}`);
    } catch (error) {
      console.error(`Failed to move file ${fileData.title}:`, error);
    }
  });
}

/**
 * Send debug Slack notification to DEFAULT_WEBHOOK (your private channel)
 */
function sendDebugSlackNotification(configKey, config, files) {
  console.log(`🐛 DEBUG: Would send notification to ${config.slackChannel} via ${config.slackWebhook}`);
  console.log(`🐛 DEBUG: Instead sending test message to DEFAULT_WEBHOOK`);
  
  // Create the actual message that would be sent to the channel
  const fileLinks = files.map(file => 
    `• <${file.webViewLink}|${file.title}>`
  ).join('\n');
  
  const actualMessage = `Today's community meeting recording, transcript and AI summary are now available on the <https://drive.google.com/drive/folders/1cN2YQiAZFJD_cb1ivlyukuNwecnin6lZ|shared llm-d google drive>:\n${fileLinks}`;
  
  const payload = {
    text: `🐛 Debug mode test for ${config.slackChannel}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🐛 *Debug mode test* - This would be sent to ${config.slackChannel}:`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: actualMessage
        }
      }
    ]
  };
  
  try {
    const response = UrlFetchApp.fetch(CONFIG.DEFAULT_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload)
    });
    
    if (response.getResponseCode() === 200) {
      console.log(`🐛 DEBUG: Test notification sent to your private channel`);
    } else {
      console.error(`🐛 DEBUG: Failed to send test notification:`, response.getResponseCode());
    }
  } catch (error) {
    console.error(`🐛 DEBUG: Failed to send test notification:`, error);
  }
}

/**
 * Send Slack notification for organized files using new configuration
 */
function sendConfiguredSlackNotification(configKey, config, files) {
  const webhookUrl = config.slackWebhook;
  const channelName = config.slackChannel;
  
  if (!webhookUrl) {
    console.log(`No webhook configured for "${configKey}", skipping notification`);
    return;
  }
  
  const fileLinks = files.map(file => 
    `• <${file.webViewLink}|${file.title}>`
  ).join('\n');
  
  const payload = {
    text: `Today's community meeting recording, transcript and AI summary are now available on the shared llm-d google drive:`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Today's community meeting recording, transcript and AI summary are now available on the <https://drive.google.com/drive/folders/1cN2YQiAZFJD_cb1ivlyukuNwecnin6lZ|shared llm-d google drive>:\n${fileLinks}`
        }
      }
    ]
  };
  
  try {
    const response = UrlFetchApp.fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload)
    });
    
    if (response.getResponseCode() === 200) {
      console.log(`Notification sent to ${channelName}`);
    } else {
      console.error(`Failed to send notification to ${channelName}:`, response.getResponseCode());
    }
  } catch (error) {
    console.error(`Failed to send notification to ${channelName}:`, error);
  }
}


/**
 * Send error notification to monitoring channel
 */
function sendErrorNotification(errorMessage) {
  if (!CONFIG.DEFAULT_WEBHOOK) {
    console.log('No DEFAULT_WEBHOOK configured, skipping error notification');
    return;
  }
  
  const payload = {
    text: `🚨 Error in LLM-D Meeting File Organizer`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🚨 *Error in LLM-D Meeting File Organizer*\n\`\`\`${errorMessage}\`\`\``
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Time:* ${new Date().toISOString()}`
        }
      }
    ]
  };
  
  try {
    UrlFetchApp.fetch(CONFIG.DEFAULT_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload)
    });
    console.log('Error notification sent to DEFAULT_WEBHOOK');
  } catch (e) {
    console.error('Failed to send error notification:', e);
  }
}

/**
 * Check if YouTube configuration is available
 */
function hasYouTubeConfig() {
  // With YouTube Advanced Service, we just need to check if it's enabled
  try {
    // Try to access the YouTube service - will throw if not enabled
    YouTube.Search.list('id', { maxResults: 1 });
    return true;
  } catch (error) {
    console.error('YouTube Advanced Service not available:', error);
    return false;
  }
}

/**
 * Upload videos to YouTube with duplicate protection
 * @returns {boolean} true if all uploads succeeded, false if any failed
 */
function uploadVideosToYoutube(recordingFiles, config) {
  let allUploadsSucceeded = true;
  
  for (const fileData of recordingFiles) {
    try {
      console.log(`Checking YouTube upload status for: ${fileData.title}`);
      
      // Check if already uploaded
      if (isAlreadyUploadedToYoutube(fileData.id)) {
        console.log(`Skipping ${fileData.title} - already uploaded to YouTube`);
        continue;
      }
      
      console.log(`Starting YouTube upload for: ${fileData.title}`);
      
      // Get file blob
      const file = DriveApp.getFileById(fileData.id);
      const blob = file.getBlob();
      
      // Use filename as video title and generate description
      const videoTitle = fileData.title;
      const videoDescription = generateVideoDescription();
      
      // Upload to YouTube using Advanced Service
      const videoId = uploadVideoToYoutube(blob, videoTitle, videoDescription);
      
      if (videoId) {
        console.log(`Successfully uploaded to YouTube: ${videoTitle} (ID: ${videoId})`);
        
        // Mark as uploaded to prevent duplicates
        markAsUploadedToYoutube(fileData.id, videoId);
        
        // Add to playlist if configured
        if (config.youtubePlaylistId) {
          try {
            addVideoToPlaylist(videoId, config.youtubePlaylistId);
          } catch (playlistError) {
            console.error(`Failed to add video to playlist:`, playlistError);
            sendErrorNotification(`Failed to add video ${videoTitle} to playlist: ${playlistError.toString()}`);
            // Don't fail the entire upload for playlist errors
          }
        }
      } else {
        console.error(`Failed to upload ${fileData.title} to YouTube - no video ID returned`);
        sendErrorNotification(`Failed to upload ${fileData.title} to YouTube - no video ID returned`);
        allUploadsSucceeded = false;
      }
      
    } catch (error) {
      console.error(`Failed to upload ${fileData.title} to YouTube:`, error);
      sendErrorNotification(`Failed to upload ${fileData.title} to YouTube: ${error.toString()}`);
      allUploadsSucceeded = false;
    }
  }
  
  return allUploadsSucceeded;
}


/**
 * Upload video to YouTube using Advanced Service
 */
function uploadVideoToYoutube(blob, title, description) {
  try {
    const resource = {
      snippet: {
        title: title,
        description: description,
        categoryId: '28' // Science & Technology
      },
      status: {
        privacyStatus: 'public'
      }
    };
    
    const response = YouTube.Videos.insert(resource, 'snippet,status', blob);
    return response.id;
  } catch (error) {
    console.error('Failed to upload video to YouTube:', error);
    return null;
  }
}

/**
 * Add video to YouTube playlist using Advanced Service
 */
function addVideoToPlaylist(videoId, playlistId) {
  try {
    const resource = {
      snippet: {
        playlistId: playlistId,
        resourceId: {
          kind: 'youtube#video',
          videoId: videoId
        }
      }
    };
    
    YouTube.PlaylistItems.insert(resource, 'snippet');
    console.log(`Added video ${videoId} to playlist ${playlistId}`);
  } catch (error) {
    console.error(`Failed to add video to playlist:`, error);
  }
}

/**
 * Check if file has already been uploaded to YouTube
 */
function isAlreadyUploadedToYoutube(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    const properties = file.getProperties();
    return properties.hasOwnProperty('youtube_uploaded') && properties['youtube_uploaded'] === 'true';
  } catch (error) {
    console.error(`Error checking upload status for file ${fileId}:`, error);
    return false;
  }
}

/**
 * Mark file as uploaded to YouTube
 */
function markAsUploadedToYoutube(fileId, videoId) {
  try {
    const file = DriveApp.getFileById(fileId);
    const properties = {
      'youtube_uploaded': 'true',
      'youtube_video_id': videoId,
      'youtube_upload_date': new Date().toISOString()
    };
    file.setProperties(properties);
    console.log(`Marked file ${fileId} as uploaded to YouTube (video ID: ${videoId})`);
  } catch (error) {
    console.error(`Error marking file ${fileId} as uploaded:`, error);
    sendErrorNotification(`Error marking file ${fileId} as uploaded: ${error.toString()}`);
  }
}

/**
 * Test YouTube authorization - run this once to authorize the YouTube service
 * This will prompt for OAuth consent and establish the authorization
 */
function testYouTubeAuthorization() {
  try {
    console.log('Testing YouTube authorization...');
    
    // Simple API call to test authorization
    YouTube.Search.list('id', {
      q: 'test',
      maxResults: 1
    });
    
    console.log('✅ YouTube authorization successful!');
    console.log('YouTube Advanced Service is properly configured and authorized.');
    
    return true;
  } catch (error) {
    console.error('❌ YouTube authorization failed:', error);
    console.log('Make sure you have:');
    console.log('1. Added YouTube Data API service in Apps Script');
    console.log('2. Completed the OAuth consent flow when prompted');
    
    return false;
  }
}

/**
 * Generate YouTube video description
 */
function generateVideoDescription() {
  return `Recording from llm-d Community Meeting

This video contains the recording of our community meeting. 

For more information about llm-d, visit: https://github.com/llm-d

Transcript and meeting notes are available on our shared Google Drive.`;
}

/**
 * Setup function - run this once to create the time-based trigger
 * This replaces Firebase Cloud Scheduler
 */
function setupAutomaticTrigger() {
  // Delete any existing triggers for this function
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'organizeMeetingFiles') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create new trigger to run every 15 minutes
  ScriptApp.newTrigger('organizeMeetingFiles')
    .timeBased()
    .everyMinutes(15)
    .create();
  
  console.log('Automatic trigger created - function will run every 15 minutes');
}

/**
 * Debug test function - run this to test in debug mode
 */
function testDebugMode() {
  const originalDebugMode = CONFIG.DEBUG_MODE;
  CONFIG.DEBUG_MODE = true;
  
  console.log('🐛 Starting DEBUG MODE test...');
  try {
    organizeMeetingFiles();
    console.log('🐛 DEBUG MODE test completed successfully');
  } catch (error) {
    console.error('🐛 DEBUG MODE test failed:', error);
  } finally {
    CONFIG.DEBUG_MODE = originalDebugMode;
  }
}

/**
 * Manual test function - run this to test the file organization
 */
function testFileOrganization() {
  console.log('Running manual test...');
  organizeMeetingFiles();
  console.log('Manual test completed');
}

/**
 * Function to list current project triggers
 */
function listTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  console.log(`Found ${triggers.length} triggers:`);
  
  triggers.forEach((trigger, index) => {
    console.log(`${index + 1}. Function: ${trigger.getHandlerFunction()}`);
    console.log(`   Type: ${trigger.getTriggerSource()}`);
    if (trigger.getTriggerSource() === ScriptApp.TriggerSource.CLOCK) {
      console.log(`   Schedule: Every ${trigger.getTimeBased().getInterval()} minutes`);
    }
  });
}