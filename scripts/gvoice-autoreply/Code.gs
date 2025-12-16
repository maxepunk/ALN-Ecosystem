/**
 * Google Voice Auto-Reply Script for ALN Game
 *
 * This script automatically replies to incoming SMS and voicemails
 * on Ashe's Google Voice number with an in-game threatening message.
 *
 * Setup:
 *   1. Create Gmail filters to label Google Voice emails (see README.md)
 *   2. Create new Google Apps Script project at script.google.com
 *   3. Paste this code
 *   4. Set up 5-minute time-driven trigger for processIncomingMessages()
 *
 * How it works:
 *   - Google Voice forwards SMS/voicemail notifications to Gmail
 *   - Gmail filters apply labels (GV-SMS, GV-Voicemail)
 *   - This script finds unread labeled emails and replies
 *   - For SMS: replies to the email thread (sends SMS back)
 *   - For voicemail: extracts caller number and sends new SMS
 */

// ============================================================================
// CONFIGURATION - Edit this message to customize the auto-reply
// ============================================================================

const AUTO_REPLY_MESSAGE = `We have Ashe's phone. Get us those memory tokens, or all of the 'anonymous' sources on this device might just accidentally find their way out into the public. Just a little additional incentive to cooperate. Now don't reach out at this number again!`;

// Gmail label names (must match your Gmail filter configuration)
const SMS_LABEL = "GV-SMS";
const VOICEMAIL_LABEL = "GV-Voicemail";
const PROCESSED_LABEL = "GV-Processed";

// ============================================================================
// MAIN FUNCTION - Set your trigger to call this
// ============================================================================

/**
 * Main entry point - processes both SMS and voicemail notifications.
 * Set a time-driven trigger to run this every 5 minutes.
 */
function processIncomingMessages() {
  console.log("=".repeat(60));
  console.log("Processing incoming messages...");

  const smsCount = processTextMessages();
  const vmCount = processVoicemails();

  console.log(`Processed: ${smsCount} SMS, ${vmCount} voicemails`);
  console.log("=".repeat(60));
}

// ============================================================================
// SMS PROCESSING
// ============================================================================

/**
 * Find and reply to unread SMS messages.
 * Replying to the Gmail thread automatically sends SMS via Google Voice.
 * @returns {number} Number of messages processed
 */
function processTextMessages() {
  const query = `is:unread label:${SMS_LABEL} -label:${PROCESSED_LABEL}`;
  const threads = GmailApp.search(query);

  if (threads.length === 0) {
    console.log("No new SMS messages");
    return 0;
  }

  console.log(`Found ${threads.length} SMS thread(s) to process`);
  const processedLabel = getOrCreateLabel(PROCESSED_LABEL);

  threads.forEach((thread, index) => {
    try {
      const subject = thread.getFirstMessageSubject();
      console.log(`  [${index + 1}] Processing: "${subject}"`);

      // Reply to thread - this sends SMS back via Google Voice
      thread.reply(AUTO_REPLY_MESSAGE);
      thread.markRead();
      thread.addLabel(processedLabel);

      console.log(`      Replied and marked as processed`);
    } catch (error) {
      console.error(`      ERROR: ${error.message}`);
    }
  });

  return threads.length;
}

// ============================================================================
// VOICEMAIL PROCESSING
// ============================================================================

/**
 * Find voicemail notifications and send SMS to the caller.
 * Unlike SMS, we need to extract the phone number and send a NEW message.
 * @returns {number} Number of voicemails processed
 */
function processVoicemails() {
  const query = `is:unread label:${VOICEMAIL_LABEL} -label:${PROCESSED_LABEL}`;
  const threads = GmailApp.search(query);

  if (threads.length === 0) {
    console.log("No new voicemails");
    return 0;
  }

  console.log(`Found ${threads.length} voicemail(s) to process`);
  const processedLabel = getOrCreateLabel(PROCESSED_LABEL);

  threads.forEach((thread, index) => {
    try {
      const message = thread.getMessages()[0];
      const subject = message.getSubject();
      const body = message.getBody();

      console.log(`  [${index + 1}] Processing voicemail: "${subject}"`);

      const phoneNumber = extractPhoneNumber(body);

      if (phoneNumber) {
        console.log(`      Caller: ${formatPhoneForDisplay(phoneNumber)}`);

        // Send SMS by emailing the Google Voice SMS gateway
        GmailApp.sendEmail(
          `${phoneNumber}@txt.voice.google.com`,
          "",  // No subject for SMS
          AUTO_REPLY_MESSAGE
        );

        console.log(`      SMS sent to caller`);
      } else {
        console.log(`      WARNING: Could not extract phone number from voicemail`);
      }

      thread.markRead();
      thread.addLabel(processedLabel);
      console.log(`      Marked as processed`);

    } catch (error) {
      console.error(`      ERROR: ${error.message}`);
    }
  });

  return threads.length;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract phone number from Google Voice voicemail email body.
 * Handles multiple formats: (XXX) XXX-XXXX, +1XXXXXXXXXX, XXX-XXX-XXXX
 * @param {string} emailBody - The HTML body of the voicemail email
 * @returns {string|null} 10-digit phone number or null if not found
 */
function extractPhoneNumber(emailBody) {
  // Convert HTML to plain text for easier parsing
  const plainText = emailBody.replace(/<[^>]*>/g, ' ');

  // Try multiple phone number patterns
  const patterns = [
    /\((\d{3})\)\s*(\d{3})-(\d{4})/,      // (415) 347-5843
    /\+1(\d{10})/,                          // +14153475843
    /(\d{3})-(\d{3})-(\d{4})/,              // 415-347-5843
    /(\d{3})\.(\d{3})\.(\d{4})/,            // 415.347.5843
    /(\d{3})\s+(\d{3})\s+(\d{4})/,          // 415 347 5843
    /(\d{10})/                              // 4153475843
  ];

  for (const pattern of patterns) {
    const match = plainText.match(pattern);
    if (match) {
      // Normalize to 10 digits (remove all non-digits)
      const digits = match[0].replace(/\D/g, '');

      // Handle +1 prefix
      if (digits.length === 11 && digits.startsWith('1')) {
        return digits.substring(1);
      }

      // Return 10-digit number
      if (digits.length === 10) {
        return digits;
      }
    }
  }

  return null;
}

/**
 * Format phone number for display in logs.
 * @param {string} phoneNumber - 10-digit phone number
 * @returns {string} Formatted as (XXX) XXX-XXXX
 */
function formatPhoneForDisplay(phoneNumber) {
  if (phoneNumber.length === 10) {
    return `(${phoneNumber.substring(0,3)}) ${phoneNumber.substring(3,6)}-${phoneNumber.substring(6)}`;
  }
  return phoneNumber;
}

/**
 * Get existing Gmail label or create it if it doesn't exist.
 * @param {string} labelName - Name of the label
 * @returns {GmailLabel} The Gmail label object
 */
function getOrCreateLabel(labelName) {
  let label = GmailApp.getUserLabelByName(labelName);
  if (!label) {
    console.log(`Creating label: ${labelName}`);
    label = GmailApp.createLabel(labelName);
  }
  return label;
}

// ============================================================================
// TEST FUNCTIONS - Use these to verify setup before enabling trigger
// ============================================================================

/**
 * Test function to verify Gmail access and labels.
 * Run this manually to check your setup.
 */
function testSetup() {
  console.log("Testing Google Voice Auto-Reply Setup");
  console.log("=".repeat(60));

  // Check labels exist
  const smsLabel = GmailApp.getUserLabelByName(SMS_LABEL);
  const vmLabel = GmailApp.getUserLabelByName(VOICEMAIL_LABEL);

  console.log(`SMS Label (${SMS_LABEL}): ${smsLabel ? 'EXISTS' : 'NOT FOUND - Create Gmail filter!'}`);
  console.log(`Voicemail Label (${VOICEMAIL_LABEL}): ${vmLabel ? 'EXISTS' : 'NOT FOUND - Create Gmail filter!'}`);

  // Count messages in each label
  if (smsLabel) {
    const smsThreads = GmailApp.search(`label:${SMS_LABEL}`);
    console.log(`  Total SMS threads: ${smsThreads.length}`);
  }

  if (vmLabel) {
    const vmThreads = GmailApp.search(`label:${VOICEMAIL_LABEL}`);
    console.log(`  Total voicemail threads: ${vmThreads.length}`);
  }

  // Check unread count
  const unreadSms = GmailApp.search(`is:unread label:${SMS_LABEL} -label:${PROCESSED_LABEL}`);
  const unreadVm = GmailApp.search(`is:unread label:${VOICEMAIL_LABEL} -label:${PROCESSED_LABEL}`);

  console.log("=".repeat(60));
  console.log(`Pending SMS to process: ${unreadSms.length}`);
  console.log(`Pending voicemails to process: ${unreadVm.length}`);
  console.log("=".repeat(60));
  console.log("Auto-reply message:");
  console.log(AUTO_REPLY_MESSAGE);
}

/**
 * Test phone number extraction with sample voicemail formats.
 */
function testPhoneExtraction() {
  const testCases = [
    { input: 'New voicemail from (415) 347-5843', expected: '4153475843' },
    { input: 'Caller: +14153475843', expected: '4153475843' },
    { input: 'From: 415-347-5843', expected: '4153475843' },
    { input: 'Number: 415.347.5843', expected: '4153475843' },
    { input: '4153475843 left a message', expected: '4153475843' },
    { input: 'No phone number here', expected: null },
  ];

  console.log("Testing phone number extraction:");
  testCases.forEach(tc => {
    const result = extractPhoneNumber(tc.input);
    const status = result === tc.expected ? 'PASS' : 'FAIL';
    console.log(`  [${status}] "${tc.input}" => ${result} (expected: ${tc.expected})`);
  });
}
