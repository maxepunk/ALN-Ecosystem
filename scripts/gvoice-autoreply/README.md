# Google Voice Auto-Reply for ALN Game

Automatic text message and voicemail response system for Ashe's phone number.

## Overview

When players contact Ashe's Google Voice number (415-347-5843) during the game, they receive an in-game threatening message:

> "We have Ashe's phone. Get us those memory tokens, or all of the 'anonymous' sources on this device might just accidentally find their way out into the public. Just a little additional incentive to cooperate. Now don't reach out at this number again!"

## How It Works

1. **Google Voice** forwards SMS and voicemail notifications to Gmail
2. **Gmail filters** label these emails (`GV-SMS`, `GV-Voicemail`)
3. **Google Apps Script** runs every 5 minutes and:
   - For SMS: replies to the email thread (sends SMS back via Google Voice)
   - For voicemails: extracts caller's number and sends them an SMS

## Prerequisites

- Google Voice number with SMS/voicemail forwarding enabled
- Gmail account linked to Google Voice
- Access to Google Apps Script ([script.google.com](https://script.google.com))

## Setup Instructions

### Step 1: Enable Google Voice Email Forwarding

1. Go to [voice.google.com](https://voice.google.com)
2. Click **Settings** (gear icon)
3. Under **Messages**, enable:
   - "Forward messages to email"
4. Under **Voicemail**, enable:
   - "Get voicemail via email"

### Step 2: Create Gmail Filters

Create two filters to label incoming Google Voice emails:

**Filter 1 - SMS Messages:**
1. In Gmail, click the search bar dropdown
2. In "From": enter `txt.voice.google.com`
3. Click "Create filter"
4. Check "Apply the label" → Create new label: `GV-SMS`
5. Check "Skip the Inbox" (optional - keeps inbox clean)
6. Click "Create filter"

**Filter 2 - Voicemails:**
1. In Gmail, click the search bar dropdown
2. In "From": enter `voice-noreply@google.com`
3. In "Subject": enter `Voicemail`
4. Click "Create filter"
5. Check "Apply the label" → Create new label: `GV-Voicemail`
6. Check "Skip the Inbox" (optional)
7. Click "Create filter"

### Step 3: Create Google Apps Script Project

1. Go to [script.google.com](https://script.google.com)
2. Click **New project**
3. Delete the default code
4. Copy and paste the contents of `Code.gs` from this directory
5. Click **Save** (Ctrl+S) and name the project "GV-AutoReply"

### Step 4: Test the Setup

1. In the Apps Script editor, select `testSetup` from the function dropdown
2. Click **Run**
3. First run will request permissions - click through to authorize
4. Check the **Execution log** (View → Execution log) for output
5. Verify labels are detected and no errors appear

### Step 5: Set Up Automatic Trigger

1. In Apps Script, click **Triggers** (clock icon in left sidebar)
2. Click **+ Add Trigger** (bottom right)
3. Configure:
   - **Function**: `processIncomingMessages`
   - **Deployment**: Head
   - **Event source**: Time-driven
   - **Type**: Minutes timer
   - **Interval**: Every 5 minutes
4. Click **Save**

### Step 6: Test End-to-End

1. Send a text message to the Google Voice number from another phone
2. Wait up to 5 minutes (or manually run `processIncomingMessages`)
3. You should receive the auto-reply message
4. Check the Execution log for details

## Customization

### Change the Auto-Reply Message

Edit the `AUTO_REPLY_MESSAGE` constant in `Code.gs`:

```javascript
const AUTO_REPLY_MESSAGE = `Your custom message here`;
```

### Change Label Names

If you prefer different Gmail labels, update these constants:

```javascript
const SMS_LABEL = "GV-SMS";
const VOICEMAIL_LABEL = "GV-Voicemail";
const PROCESSED_LABEL = "GV-Processed";
```

## Troubleshooting

### Messages Not Being Processed

1. **Check labels exist**: Run `testSetup` function and verify labels are found
2. **Check filter configuration**: Send a test SMS and verify it gets the correct label
3. **Check trigger is running**: View trigger execution history in Apps Script

### "Label not found" Error

Create the Gmail labels manually:
1. In Gmail sidebar, scroll to bottom
2. Click "Create new label"
3. Name it exactly: `GV-SMS` (or `GV-Voicemail`)

### Voicemail SMS Not Sending

1. Run `testPhoneExtraction` to verify phone parsing works
2. Check the voicemail email format in Gmail
3. The phone number must be in one of these formats:
   - `(415) 347-5843`
   - `415-347-5843`
   - `+14153475843`
   - `4153475843`

### Quota Limits

Google Apps Script has daily quotas:
- Email sends: 100/day (Gmail)
- Script runtime: 6 minutes per execution

For a game session, this is more than sufficient.

## Files

| File | Purpose |
|------|---------|
| `Code.gs` | Google Apps Script code (copy to script.google.com) |
| `README.md` | This setup guide |

## Future Enhancements

When ready to integrate Claude SDK for conversational responses:
- Replace `AUTO_REPLY_MESSAGE` constant with API call
- Add conversation state tracking per phone number
- Integrate with ALN backend for session-aware responses

## Technical Details

### How SMS Reply Works

Google Voice has a special email integration:
- SMS notifications come from `@txt.voice.google.com`
- Replying to these emails sends an SMS back through Google Voice
- This is the "trick" that makes the auto-reply work without an official API

### How Voicemail SMS Works

Voicemail notifications are different:
- They come from `voice-noreply@google.com`
- They contain the caller's phone number in the email body
- We extract the number and send a NEW email to `[number]@txt.voice.google.com`
- This initiates an SMS conversation with the caller

## References

- [Google Apps Script Documentation](https://developers.google.com/apps-script)
- [GmailApp Reference](https://developers.google.com/apps-script/reference/gmail/gmail-app)
- Inspired by [Benmatic/SMS-Auto-Reply](https://github.com/Benmatic/SMS-Auto-Reply)
