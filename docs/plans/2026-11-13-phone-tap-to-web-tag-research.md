# A player's own phone taps a token: what the tag and its web address must hold

Today's tag opens the game's page on an iPhone and does not on an Android phone. An iPhone looks through the whole tag for a web address, shows a notification, and opens the address in Safari when the player touches the notification. An Android phone looks only at the first record on the tag. On our tags the first record is the token id as text, so an Android phone with nothing installed opens nothing. For Android the web address has to be the first record and the token id the second. The owner's note of 2026-11-13 expected the layout to need a change for iPhone. The sources say the reverse. The layout is fine for iPhone and has to change for Android. That swap needs new firmware on the hardware scanners, a small edit to the tag-writing tool, and one rewrite of the tags. The GM scanner already reads the id in either order. The project's records show no test with an Android phone, so the first step is the five-minute test in "What is still unknown".

Research by a helper, 2026-11-13, on branch `claude/nice-curie-hescfv` at `f6a2c6cb`, for the open item "The tag's layout for phones" in `docs/plans/architecture-pass/design/2026-11-13-the-messages-and-files.md`. It rests on Apple's and Android's developer documentation, Android's and Chrome's source code, the W3C Web NFC draft, NXP's data sheets, and this repository. No phone was at hand, so nothing here was tried on one.

How to read the source column:

- `scanner/` means `arduino-cyd-player-scanner/` at submodule commit `f81aba5`. Other paths are written in full. `ALNScanner/` is at `b521774`, `aln-memory-scanner/` at `e0bf299`, `ALN-TokenData/` at `6f9bc30`.
- A key such as [A1] points to a line under Sources, with the address and the date read.
- A number such as [3.2] points to a row in this file.
- "Not confirmed" marks what no source or test backs yet.
- NDEF is the standard format for the data on a tag. A tag holds one NDEF message, and the message holds records.

## What we found

### 1. Our tags today

| # | Fact | Source |
|---|---|---|
| 1.1 | A tag holds two records. The first is a text record with the token id. The second is a URL record with the address of the phone page and the token id in its query string. | `ALN-TokenData/shared/aln-tools.js:149-157`; `ALN-TokenData/tag-writer.html:444-446` |
| 1.2 | The tag-writing tool fails a tag whose first record is not text. Its guide says "Text record MUST be first". | `ALN-TokenData/tag-writer.html:479-500`; `ALN-TokenData/CLAUDE.md:93-96` |
| 1.3 | The one real tag whose bytes are in the repository is an NTAG215 with 496 bytes of room. Its message is 69 bytes: 13 for the text record, 56 for the URL record. The bytes come from token `mar004`, captured on 2026-04-16. | `scanner/test/test_ndef/test_ndef.cpp:258-275`; `scanner` commit `3487918`; size byte `3Eh` per [N3] |
| 1.4 | That tag's address starts `https://raspberr` and runs 51 characters after `https://`. That is the length of `raspberrypi.local:3000/player-scanner/?token=mar004`. It is not the `aln-orchestrator.local` address that the design note gives. | same bytes; `docs/plans/architecture-pass/design/2026-11-13-the-messages-and-files.md`, "What happens today" |
| 1.5 | The tag-writing tool offers both names and starts on `raspberrypi.local`. What address the other tags hold is not recorded. | `ALN-TokenData/tag-writer.html:156-160`; `ALN-TokenData/shared/aln-tools.js:7-23`, `:41` |
| 1.6 | The pack has 81 tokens. Every id is three letters and three digits, such as `mar004`. | `ALN-TokenData/tokens.json`, counted 2026-11-13 |
| 1.7 | The plan that introduced this layout expected Android to open the URL record with text first. Its test line for an Android phone was never ticked. No later record shows a test with an Android phone. | `docs/ARCHIVE/2025-01-completed-phase-plans/dual-record-nfc-tags.md:16-29`, `:970` |

### 2. iPhone

| # | Fact | Source |
|---|---|---|
| 2.1 | "iPhone XS and later support background tag reading." That is Apple's name for reading a tag with no app open. | [A1] |
| 2.2 | Apple's user guide lists the SE from the 2nd generation, the XR, the XS and the newer models as reading tags automatically. On the iPhone 8, 8 Plus and X the player must first switch on "NFC Tag Reader" in Control Center. The iOS 15 edition adds the 7 and 7 Plus to that second group. | [A3] |
| 2.3 | iOS 17 runs on the XR, the XS and newer models only. So every iPhone on iOS 17 or later is in the automatic group. | [A4]; row 2.2 |
| 2.4 | Apple's page names no iOS version for the feature. The interface that hands a background-read tag to an app is marked iOS 12.0 and later. | [A1]; [A2] |
| 2.5 | The phone "inspects the tag's NDEF message for a URI record", which it knows as a well-known record of type "U". "If the NDEF message contains more than one URI record, the system uses the first one." Apple does not ask for that record to be first on the tag. | [A1] |
| 2.6 | A text record in front of the URL record does no harm. Spike S1 passed on a production token on 2026-07-17, and our tags are text first. | `docs/plans/PHASE3-STATUS.md:852-856`; rows 1.1, 1.3 |
| 2.7 | Apple lists "Website URL (HTTP/HTTPS)" as a supported address, with the example `https://www.example.com`. Another example in the same table has a query string. | [A1] |
| 2.8 | Apple's page says nothing about port numbers, `.local` names or plain IP addresses. Our only evidence for a `.local` name with `:3000` is S1. The S1 record does not name the token, the phone or the iOS version, and does not say whether the page loaded. A plain IP address is not confirmed. | [A1]; `docs/plans/PHASE3-STATUS.md:852-856` |
| 2.9 | The player sees a notification and must touch it. "The system displays a pop-up notification each time it reads a new tag. After the user taps the notification, the system delivers the tag data to the appropriate app." With no app tied to the address, "the system opens the link in Safari". Whether a phone with another default browser opens that browser is not confirmed. | [A1] |
| 2.10 | The phone reads tags only while it is "in use". Apple lists five cases where the screen is on and it still does not read: "The device has never been unlocked", "A Core NFC reader session is in progress", "Apple Pay Wallet is in use", "The camera is in use", "Airplane mode is enabled". | [A1] |
| 2.11 | "If the iPhone is locked, the system prompts the user to unlock the phone before providing the tag data to the app." | [A1] |
| 2.12 | Apple's page describes no certificate check at the tap. The phone hands the address to Safari, and Safari checks the certificate as it does for any page. Safari shows a "Not Secure" or "This Connection Is Not Secure" message when "The website is encrypted, but its certificate is expired or illegitimate". So a bad certificate does not stop the tag read. It puts a warning between the tap and the phone page. Whether S1 met that warning is not recorded. | [A1]; [A5] |
| 2.13 | A web page in Safari cannot read tags itself. WebKit's recorded position on Web NFC is "oppose". WebKit lists the "Web NFC API" among features "we have decided to not yet implement". MDN's compatibility data marks Safari as not supporting it, on Mac and on iPhone. Chrome's status page lists Android only. | [A8]; [A7]; [W2]; [C2] |

### 3. Android

| # | Fact | Source |
|---|---|---|
| 3.1 | "The system reads the first NdefRecord inside the NdefMessage to determine how to interpret the entire NDEF message." The reference page: "The system inspects the first NdefRecord in the first NdefMessage and looks for a URI, SmartPoster, or MIME record." | [G1]; [G2] |
| 3.2 | The source code takes record 0 and no other. This holds in Android 10, 14, 15, 16 and 17. | [G3]; [G7] |
| 3.3 | A first record of type text maps to "MIME type of text/plain". The phone then looks for an app that asked for text tags. | [G1]; [G6] |
| 3.4 | A browser is not such an app. Chrome asks for tags only when the first record is an http or https address. | [C3] |
| 3.5 | When no app wants the tag: "If no applications filter for any of the intents, do nothing." So today's tag opens nothing on an Android phone with nothing installed. | [G1]; rows 3.1 to 3.4 |
| 3.6 | What the player sees then differs by phone. The source has a message, "No supported application for this NFC Tag", that the phone maker can switch on. On some phones it also pauses tag reading for 2 seconds after such a tap. | [G4]; [G5] |
| 3.7 | Android has an optional viewer app named Tags that takes any tag with NDEF data and shows its contents. Which phones ship it is not confirmed. | [G8] |
| 3.8 | With the URL record first, Android maps the tag to its address and passes it to an app that opens addresses. Android 15 and earlier send a tag-specific request, which Chrome accepts. | [G1]; [C3] |
| 3.9 | "Starting in Android 16, scanning NFC tags that store web links ... triggers the ACTION_VIEW intent instead of the ACTION_NDEF_DISCOVERED intent." ACTION_VIEW is the ordinary request to open an address. | [G1] |
| 3.10 | "Beginning with Android 17, scanning such a tag surfaces an 'open link' notification, requiring explicit user interaction to trigger the ACTION_VIEW intent." The Android 17 source shows an "Open link?" dialog that the phone maker switches on, and it is off in the stock code. Expect one extra touch on some phones. | [G1]; [G3]; [G5] |
| 3.11 | "If more than one application can handle the intent, the Activity Chooser is presented so the user can select the Activity." | [G1] |
| 3.12 | Android phones look for tags "when the screen is unlocked, unless NFC is disabled in the device's Settings menu". Some Android phones have no NFC hardware. | [G1] |
| 3.13 | Chrome on Android can read tags inside a web page from version 89. "Web NFC is only available to top-level frames and secure browsing contexts (HTTPS only). Origins must first request the 'nfc' permission while handling a user gesture (e.g a button click)." The page must be visible and the phone unlocked. | [C1]; [C2]; [W1] |
| 3.14 | The W3C text for Web NFC is a draft from a community group. It is not a standard. | [W1] |
| 3.15 | A page that is reading tags takes the tap. While a page has a scan running, Chrome puts the phone in reader mode. Android then gives the tag to that page and skips rows 3.1 to 3.11. W3C states the other half: "Scanning a tag when a Web NFC scan is not active, triggers the host OS handling." | [C5]; [G4]; [W1] |

### 4. The web address

| # | Fact | Source |
|---|---|---|
| 4.1 | The name need not be public for the tap. Android checks only that the address starts with http. Apple asks only for a website address. | [G3]; [A1] |
| 4.2 | The certificate is what needs a public name. Certificate authorities "SHALL NOT issue Certificates containing Internal Names or Reserved IP Addresses". A `.local` name and a 192.168 address both fall under that rule. Roadmap row 8.19 already plans a real name. | [X1]; `docs/plans/ROADMAP.md:629` |
| 4.3 | `.local` names. On iPhone, S1 is the only evidence. On Android, the current resolver source has code for `.local` names. Which Android versions carry it is not confirmed. | row 2.8; [G9] |
| 4.4 | A private address is no obstacle in Safari. iPhone apps need the user's permission to reach devices on the local network, and Apple exempts "Traffic originating from WKWebView, SFSafariViewController, and Safari". | [A6] |
| 4.5 | A port number. Neither maker's page forbids one. A browser treats scheme, name and port together as one site and keeps each site's stored data apart. So what the phone page stores belongs to the name plus the port. If either changes later, every phone starts from empty. | [A1]; [G1]; [X3]; [X4] |
| 4.6 | The query string. Android passes the address on whole and lower-cases only the scheme and the host. Apple's own table has an address with a query string. The phone page reads `token` from the query and then clears it from the address bar. Whether the token showed on the iPhone in S1 is not recorded. | [G2]; [A1]; `aln-memory-scanner/js/app.js:538-554` |
| 4.7 | The record type. Apple looks for a well-known record of type "U". The tag-writing tool's "url" record is that type. Web NFC also has an "absolute-url" record, which is a different type. | [A1]; [W1]; `ALN-TokenData/shared/aln-tools.js:154` |
| 4.8 | The backend tells every browser to refuse this site whenever its certificate is wrong, for 180 days, subdomains included. That is the default of the helmet library, 7.2.0 installed. A browser ignores the instruction while the certificate has an error, which is the case today. | `backend/src/app.js:45-47`; `backend/package.json:96`; [X2] section 8.1 |
| 4.9 | With a real certificate the browser records the instruction. From then on the standard says it must end the connection on any certificate error and offer no way to continue. Today a GM touches "proceed" once per device. Later, a kit whose certificate has run out would shut out every phone and tablet that had visited before. This follows from the code and the standard. It was not tried in Safari or Chrome. | [X2] sections 8.4, 12.1; `backend/CLAUDE.md:611-614` |

### 5. Limits for a game

| # | Fact | Source |
|---|---|---|
| 5.1 | No maker gives a time between taps. Apple: a notification "each time it reads a new tag". Whether the same tag counts again at once is not confirmed. Android's source sets no wait after a tap that opened something, and checks every 125 ms whether the tag is still there. | [A1]; [G4] |
| 5.2 | On Android with Chrome, every tap opens a new tab, going by the source. Chrome opens a new tab for a request that names no sending app, and Android's tag request names none. Thirty tokens make thirty tabs. On iPhone this is not confirmed. | [C4]; [G3] |
| 5.3 | Every tap loads the phone page from the start, so the page carries nothing over in memory. Data kept per tab does not reach a new tab either, and the page keeps the current team that way. Data kept per site does survive. The collection and the device id live there. | [X4]; `aln-memory-scanner/js/app.js:435`, `:196-214`; `aln-memory-scanner/js/orchestratorIntegration.js:20-24` |
| 5.4 | On Android, later taps can stay in one tab. Once the phone page is open with its own scan running, row 3.15 applies and no tab opens. That needs Chrome, one button press and one permission prompt. iPhone has no such path. | rows 3.13, 3.15; `aln-memory-scanner/js/app.js:265-274`, `:312-346` |
| 5.5 | Sound does not start by itself. A tap opens the page with no touch inside the page. Safari on iPhone "has required a user gesture to play media in a `<video>` or `<audio>` element". Chrome allows sound when "The user has interacted with the domain (click, tap, etc.)". The phone page tries to play and falls back to a tap-to-play state, so the player touches the screen once to hear a token. | [A9]; [C6]; `aln-memory-scanner/js/tokenDisplay.js:93-108` |
| 5.6 | A fixed address proves nothing about a tap. The phone gives the browser the address and nothing else. The address is the same on every tap, and "Any NDEF data on a tag can be read by any app or web site with the proper access". NDEF itself "doesn't provide any way to make the content trusted". So the backend cannot tell a tap from the same address typed or passed along. | [A1]; [G1]; [W1] |
| 5.7 | A long random code in the address would stop guessing, which ids of three letters and three digits invite. It would not stop copying. It would also do nothing until the backend checks it. Today the backend takes a scan for any token id from any device. | rows 1.6, 5.6; `docs/plans/architecture-pass/design/2026-11-13-the-messages-and-files.md`, "What happens today" |
| 5.8 | NXP's NTAG 424 DNA makes a new address on every tap. It "generates a Secure Unique NFC (SUN) message for the authentication each time it is being tapped", and the phone "reads this tap-unique URL". Phones "open the link without any dedicated application installed". | [N1]; [N2] |
| 5.9 | That tag needs a backend that holds its keys and checks every message. NXP: "anybody can read out the message" and play it back later. "Track SDMReadCtr per tag at the verifying side. Reject SDMReadCtr values that have been seen before or that are played out-of-order. This is a minimum requirement any verifier should implement." | [N1] section 9.3 |
| 5.10 | It is another kind of tag: an NFC Forum Type 4 Tag whose type byte, the SAK, is 20h. The hardware scanner stops at any tag whose SAK is not 00h and reads with a Type 2 command. It would need a new way of reading, which is more than a parser edit. | [N1]; `scanner/ALNScanner_v5/hal/NDEFParser.h:32-36`; `scanner/ALNScanner_v5/hal/RFIDReader.h:612-648` |
| 5.11 | The tag-writing tool could not set such a tag up. Web NFC has no low-level commands. Whether an iPhone opens its address with no app is not confirmed. NXP's 2019 data sheet says "Android (without a dedicated app) and iOS11 (with an app)". | [W1]; [N1] |
| 5.12 | Anyone can rewrite our tags. The captured tag's last capability byte is `00`. NXP's read-only state is `0F`. Nothing in the repository locks a tag. A phone with a tag-writing app can change a token's address. W3C: deployed tags "should always be made read-only". Chrome can lock a tag, and "This operation is a one-way process and cannot be reversed". | row 1.3; [N3]; [W1]; [C1] |

## What it means for our tags and scanners

### Who reads what today

| Reader | What it takes from the tag | Source |
|---|---|---|
| iPhone, no app | The first URL record, wherever it is | row 2.5 |
| Android phone, no app | The first record only | rows 3.1, 3.2 |
| Hardware scanner | The first record only, and only if it is text. It reads 32 bytes of the tag in one exchange. | `scanner/ALNScanner_v5/hal/NDEFParser.h:99-120`; `scanner/ALNScanner_v5/hal/RFIDReader.h:671-684` |
| GM scanner | The first text record, wherever it is. It refuses a tag with no text record. | `ALNScanner/src/utils/nfcHandler.js:116-149` |
| Phone page reading tags itself, Chrome on Android | The first text record, wherever it is | `aln-memory-scanner/js/app.js:332-342` |
| Token check-in tool | The first text record, wherever it is | `ALN-TokenData/token-checkin.html:538-544` |
| Tag-writing tool | It writes text, then URL. Its check fails any other order. | rows 1.1, 1.2 |

### Three layouts

| | A. Keep text first | B. Address first, text second | C. Address only |
|---|---|---|---|
| iPhone tap | Opens the page | Opens the page | Opens the page |
| Android tap | Opens nothing | Opens the page | Opens the page |
| Hardware scanner | No change | New firmware | New firmware |
| GM scanner | No change | Reads it as is. One new behavior, described below. | Must change. It refuses such a tag today. |
| Tag-writing tool | No change | Swap two records, change one check | Write one record, drop the check |
| Token check-in tool | No change | No change | Must change |
| Tags | No change | Rewrite all | Rewrite all |

Layout A leaves Android players with the phone page's own tag reading. They open the page by hand, press its scan button and allow NFC. That works in Chrome only [3.13], and design principle P7 rejects it as the basis (`docs/decisions/2026-06-11-engine-design-notes-b4-b10.md:77-85`).

Layout B is the smallest change that gives both phones the tap. The next part spells out what it asks.

Layout C saves 13 bytes and ties every reader to the shape of the address. The GM scanner refuses a tag without a text record on purpose (`ALNScanner/src/utils/nfcHandler.js:139-149`, `ALNScanner/tests/unit/utils/nfcHandler.test.js:102-115`). C costs more than B and gives the player nothing more.

### What layout B asks of each part

**Hardware scanner.** It must change, and it must change before any tag does.

- Today it reads tag memory pages 3 to 10, 32 bytes, in one exchange. An exchange is one command to the tag and the tag's reply. `parseNDEFText()` then looks at the first record only. If that record is not text it returns nothing, and the scanner shows READ FAILED. A unit test pins this for a URL record. See `scanner/ALNScanner_v5/hal/RFIDReader.h:671-684`, `scanner/ALNScanner_v5/hal/NDEFParser.h:99-120`, `scanner/test/test_ndef/test_ndef.cpp:197-215`.
- With the address first, the token id sits behind the address. For an address as long as today's, 56 characters after `https://`, the text record fills bytes 67 to 79, counted from the start of page 3. The read must reach page 22.
- One exchange returns 60 bytes at most. The reader chip's buffer holds 64 bytes [N4]. The code collects the reply after it ends and treats an overflow as an error (`scanner/ALNScanner_v5/hal/RFIDReader.h:305-362`). Reaching page 22 takes two exchanges.
- The code's own comments say one exchange was chosen because the gap between two reads was "the dominant historical failure mode" (`scanner/ALNScanner_v5/hal/RFIDReader.h:612-619`). Two exchanges bring that gap back.
- The parser must walk the records. It reads each record's header and lengths, skips a record that is not text, and stops after the last one. Today it assumes the text record opens the message (`scanner/ALNScanner_v5/hal/NDEFParser.h:105-124`).
- Taking the id from the address is no shortcut. The id ends the address, so it lies as far into the tag.
- A parser that walks records reads both layouts. Flash the hardware scanners first and rewrite the tags after.
- Flashing is by USB today (`scanner/CLAUDE.md:276`). The sibling note `docs/plans/2026-11-13-hardware-scanner-ota-research.md` finds that each scanner needs one more USB flash before it can update over the air. The new tag reading could go in that same flash.

A shorter address keeps the read at one exchange. This is arithmetic from the byte layout. It is not a bench result. Both records fit in 60 bytes when the address after `https://` is 36 characters or fewer, the 6-character id included. Today's is 56. `play.aboutlastnightgame.com/t/mar004` is 36. The backend would have to answer that short path. A 60-byte read in one exchange has not been tried on the hardware.

**GM scanner.** It needs no change to read the tags. It scans every record for the first text record, and a unit test covers a tag with the URL first (`ALNScanner/src/utils/nfcHandler.js:116-137`, `ALNScanner/tests/unit/utils/nfcHandler.test.js:72-86`).

One behavior is new. The GM scanner scans only from the moment a team is confirmed until that team is finished or cancelled (`ALNScanner/src/app/domains/gameOps.js:118-145`, `:386-408`). On its team entry screen no scan is running, so Android handles a tap itself [3.15]. With layout B, a token held to that phone or tablet opens the phone page in a new Chrome tab. That page sends a player scan, and for a video token the backend can start the video (`aln-memory-scanner/js/app.js:431-444`, `backend/src/routes/scanRoutes.js:90-100`). Today the same touch does nothing. Keeping a scan running whenever the GM scanner is on screen would prevent it.

**Tag-writing tool.** Swap the two records in `ALN-TokenData/shared/aln-tools.js:151-156`. Change the check that demands text first, at `ALN-TokenData/tag-writer.html:482` and `:494-496`. Keep the "url" record type [4.7]. Correct `ALN-TokenData/CLAUDE.md:93-96`, which says text must be first.

**Phone page and token check-in tool.** No change. Both find the text record wherever it is.

**Tags.** Rewrite every one. The move to a real name needs that too, since the name is inside the address. One pass can do both.

**A code that cannot be guessed.** Any layout can carry one in the address. It lengthens the address, which the hardware scanner's read pays for under layout B. Row 5.7 says what it buys.

### The helper's reading

Layout B is the smallest change that makes the tap work on both kinds of phone. Its one large cost is the hardware scanner, and that cost shrinks when the address is short enough for one read. So the address and the layout should be decided together. Nothing here is worth starting before tests U1 to U3 below, which take one Android phone, one iPhone and one spare tag.

## What is still unknown

| # | What we do not know | How to find out |
|---|---|---|
| U1 | What an Android phone does with today's tag | Unlock an Android phone that has no tag app, close Chrome, and hold the phone to a production token. Write down the model, the Android version and what appears. Use a Google Pixel and a Samsung if both are at hand, since phone makers alter this part. The sources predict that nothing opens. |
| U2 | Whether a tag with the address first opens the page on Android, and with how many touches | Write one spare tag with the address first and the id second, using any tag-writing app. Tap it with the same phones. Note whether Chrome opens at once or asks "Open link?", whether each tap makes a new tab, and how soon a second tap works. |
| U3 | Whether that spare tag still works on iPhone | Tap it with an iPhone XS or later. Apple's page predicts the same notification as today. |
| U4 | What our scanners do with that spare tag today | Tap it on a hardware scanner and on the GM scanner. Expected: READ FAILED on the hardware scanner, a normal read on the GM scanner while it scans, and the phone page opening on the GM scanner's device while it sits on team entry. |
| U5 | The details the S1 record left out | Repeat S1. Write down the phone, the iOS version, the token, the address on the tag, whether a certificate warning appeared, whether the token showed, whether a second tap made a new tab, how soon it worked, and what a locked phone did. |
| U6 | What address each real tag holds | Read a sample of tokens with a tag reader app and note the name in the address. |
| U7 | Whether an iPhone accepts a plain IP address | One spare tag with `https://<the backend's IP>:3000/player-scanner/?token=<id>`. Only worth doing if a tag without a name is ever wanted. |
| U8 | Whether the hardware scanner reads 60 bytes in one exchange as well as it reads 32 | On one scanner, read pages 3 to 17 in place of 3 to 10, switch on `NDEF_DEBUG`, tap one token 100 times and count the failures. Compare with the same count on today's firmware. |
| U9 | Whether a phone on the kit's Wi-Fi, which has no internet, reaches the backend by its real name | Not researched here. The plan already holds this test (`docs/decisions/2026-07-09-kit-network-posture.md:39-41`). Run it with the phone's mobile data switched on, once with an iPhone and once with an Android phone. |
| U10 | Whether other default browsers behave like Chrome and Safari | Repeat U2 with Samsung Internet or Firefox set as the default browser. |
| U11 | Whether Android 17 phones show the extra "open link" step | Run U2 on a phone with Android 17. |
| U12 | Whether an iPhone opens an NTAG 424 DNA address with no app | Only if that kind of tag is ever wanted. Buy one, set it up with NXP's tools and tap it. |

## Sources

Every web source was read on 2026-11-13.

Apple and WebKit

- [A1] https://developer.apple.com/documentation/corenfc/adding-support-for-background-tag-reading . "Adding Support for Background Tag Reading". Read through the documentation site's data file, https://developer.apple.com/tutorials/data/documentation/corenfc/adding-support-for-background-tag-reading.json , because the page itself needs JavaScript.
- [A2] https://developer.apple.com/documentation/foundation/nsuseractivity/ndefmessagepayload . "The NDEF message read by the system in the background." Marked iOS 12.0+. Read the same way.
- [A3] https://support.apple.com/guide/iphone/aside/asd-nfc-reader/16.0/ios and the same address with `15.0`. iPhone User Guide, "Models that support NFC Tag Reader". The editions for iOS 17 and later have no such page.
- [A4] https://support.apple.com/guide/iphone/iphone-models-compatible-with-ios-17-iphe3fa5df43/17.0/ios/17.0 . The list starts at the XR and the XS.
- [A5] https://support.apple.com/en-us/102279 . "If you see a 'Not Secure' warning while browsing with Safari". Published 2026-07-14.
- [A6] https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy . TN3179, "Local network operations", the list of exceptions.
- [A7] https://webkit.org/tracking-prevention/ . "features we have decided to not yet implement due to fingerprinting, security, and other concerns".
- [A8] https://github.com/WebKit/standards-positions/issues/584 . The position was read from WebKit's own data file, https://raw.githubusercontent.com/WebKit/standards-positions/main/summary.json : title "Web NFC", position "oppose", concerns "privacy", "security", "device independence".
- [A9] https://webkit.org/blog/6784/new-video-policies-for-ios/ . WebKit blog, 2016-07-25.

Android

- [G1] https://developer.android.com/develop/connectivity/nfc/nfc . "NFC basics", last updated 2026-10-23. Sections "The tag dispatch system", "How NFC tags are mapped to MIME types and URIs" with its Table 2, "How NFC tags are dispatched to applications".
- [G2] https://developer.android.com/reference/android/nfc/NfcAdapter . `ACTION_NDEF_DISCOVERED`: the first-record sentence, and "The MIME type or data URI of this intent are normalized before dispatch - so that MIME, URI scheme and URI host are always lower-case."
- [G3] https://android.googlesource.com/platform/packages/modules/Nfc/+/refs/heads/android17-release/NfcNci/src/com/android/nfc/NfcDispatcher.java at commit `940212c440f5`. Lines 295-296 take record 0. Lines 742-769 try NDEF, then tag technology, then any tag, then fail. Lines 1041-1056 turn a web address into a request to open it. Lines 1371-1398 hold the "Open link?" dialog behind the setting `enable_nfc_url_open_dialog`. The file sets no sending-app name on the request.
- [G4] `NfcService.java` in the same directory and commit. Line 325: the 125 ms presence check. Line 6448: a reader-mode page or app gets the tag and dispatch stops. Lines 6465-6490: after a failed dispatch, the pause and the optional message. Lines 6354-6375: the pause itself.
- [G5] `NfcNci/res/values/config.xml` lines 3, 5, 16-19 and `NfcNci/res/values/strings.xml` lines 91, 102, same commit. `enable_nfc_url_open_dialog` and `enable_notify_dispatch_failed` are false. `unknown_tag_polling_delay` is 2000.
- [G6] `framework/java/android/nfc/NdefRecord.java`, same repository and commit. Lines 684-696: a text record gives `text/plain`. Lines 718-760: which records give an address. Lines 241-247: the prefix code `0x04` means `https://`.
- [G7] The same record-0 lines in older code: https://android.googlesource.com/platform/packages/apps/Nfc/+/refs/heads/android10-release/src/com/android/nfc/NfcDispatcher.java lines 172-173, `android14-release` lines 207-208, `android15-release` lines 238-239, and `android16-release` of the repository in [G3], lines 264-265.
- [G8] https://android.googlesource.com/platform/packages/apps/Tag/+/refs/heads/main/AndroidManifest.xml . The viewer filters `TECH_DISCOVERED` with the comment "Offer to display anything with NDEF data".
- [G9] https://android.googlesource.com/platform/packages/modules/DnsResolver/+/refs/heads/main/res_send.cpp . `send_mdns`, lines 163 and 479.

Chrome and Chromium

- [C1] https://developer.chrome.com/docs/capabilities/nfc . "Interact with NFC devices on Chrome for Android". Sections "Security and permissions", "Make NFC tags read-only", "Browser support".
- [C2] https://chromestatus.com/feature/6261030015467520 . "Web NFC": enabled by default in Chrome for Android 89, no desktop or iOS entry, Firefox and Safari views "Negative". Read through https://chromestatus.com/api/v0/features/6261030015467520 .
- [C3] https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/android/java/AndroidManifest.xml at commit `c291ca4d5036`, lines 385-390. The only NFC filter is `NDEF_DISCOVERED` with schemes http and https.
- [C4] `chrome/android/java/src/org/chromium/chrome/browser/IntentHandler.java`, same commit, lines 1240-1268. "The default behavior here is to open in a new tab." "Due to users complaints, we are NOT reusing tabs for apps that do not specify an appId."
- [C5] `services/device/nfc/android/java/src/org/chromium/device/nfc/NfcImpl.java`, same commit, lines 473-493. `enableReaderMode` while a page has NFC work in progress.
- [C6] https://developer.chrome.com/blog/autoplay . "Autoplay policy in Chrome".

W3C and MDN

- [W1] https://w3c-cg.github.io/web-nfc/ . "Web NFC", a Draft Community Group Report. The older address https://w3c.github.io/web-nfc/ now answers "Moved". Used: the record formats, "Security and Privacy", "Security policies", and the scope note that low-level commands "are not supported".
- [W2] https://github.com/mdn/browser-compat-data/blob/main/api/NDEFReader.json . Chrome for Android "89". Safari `false`. Safari on iOS mirrors Safari. Firefox `false`.

NXP

- [N1] https://www.nxp.com/docs/en/data-sheet/NT4H2421Gx.pdf . NTAG 424 DNA data sheet, Rev. 3.0, 2019-01-31. Section 1.1, the SAK paragraph, section 9.3.
- [N2] https://www.nxp.com/docs/en/application-note/AN12196.pdf . "NTAG 424 DNA and NTAG 424 DNA TagTamper features and hints", Rev. 2.0, 2025-03-04. Section 1.
- [N3] https://www.nxp.com/docs/en/data-sheet/NTAG213_215_216.pdf . Data sheet, Rev. 3.2, 2015-06-02. Section 8.5.4: size byte `3Eh` is NTAG215 with 496 bytes, and Fig 13 shows the read-only state.
- [N4] https://www.nxp.com/docs/en/data-sheet/MFRC522.pdf . Reader chip data sheet, Rev. 3.9, 2016-04-27. "FIFO buffer handles 64 byte send and receive".

Other standards

- [X1] https://github.com/cabforum/servercert/blob/main/docs/BR.md . CA/Browser Forum Baseline Requirements, version 2.3.1, 2026-10-04, section 4.2.2, with the definitions of "Internal Name" and "Reserved IP Address".
- [X2] https://www.rfc-editor.org/rfc/rfc6797 . HTTP Strict Transport Security, sections 8.1, 8.4 and 12.1.
- [X3] https://www.rfc-editor.org/rfc/rfc6454 . The Web Origin Concept, section 5: two origins are the same only with "identical schemes, hosts, and ports".
- [X4] https://html.spec.whatwg.org/multipage/webstorage.html . HTML Standard, section 12.1. Per-tab storage: "each one would have its own individual copy of the session storage object". Per-site storage "spans multiple windows, and lasts beyond the current session".

What could not be read, and what stood in

- The NFC Forum sells its specification texts. Its NDEF page, https://nfc-forum.org/build/specifications/data-exchange-format-ndef-technical-specification/ , offers "Purchase Specification". They were not read. The record formats come from [W1], and Android's reading of them from [G6].
- GitHub's interface for [A8] answered 403 through this container's proxy. WebKit's `summary.json` from the same repository stood in.
- Chrome's help page on connection errors, https://support.google.com/chrome/answer/6098869 , no longer describes the certificate warning. Chrome's warning is taken from the project's own record, `backend/CLAUDE.md:611-614`.
- NXP's short product address https://www.nxp.com/products/NTAG424DNA answered "Page not available". The data sheets loaded.
- Android's pages of behavior changes for versions 16 and 17 do not mention NFC. The change is on [G1] only.
