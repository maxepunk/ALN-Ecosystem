/**
 * VideoPlaybackCheck - Verify video triggers and playback chain
 *
 * Video playback business logic:
 * - Player scans (HTTP POST /api/scan) trigger video queue if token.hasVideo()
 * - GM scans (WebSocket) do NOT trigger video
 * - Video events are logged: "Video playback started", "video queued"
 */

class VideoPlaybackCheck {
  constructor(logParser, tokensMap) {
    this.logParser = logParser;
    this.tokensMap = tokensMap;
    this.name = 'Video Playback';
  }

  /**
   * Run the validation check
   * @param {Object} session - Session data
   * @returns {Object} Check result
   */
  async run(session) {
    const findings = [];
    let status = 'PASS';

    // CRITICAL FIX: sessions use startTime, not createdAt (createdAt is always undefined)
    const sessionStart = session.startTime;
    const sessionEnd = session.endTime || new Date().toISOString();

    // Find tokens with video
    const videoTokens = new Set();
    if (this.tokensMap) {
      for (const [tokenId, token] of this.tokensMap) {
        if (token.video) {
          videoTokens.add(tokenId);
        }
      }
    }

    // Get video playback events from logs
    let videoEvents = [];
    try {
      videoEvents = await this.logParser.findVideoPlaybackEvents(sessionStart, sessionEnd);
    } catch (err) {
      findings.push({
        severity: 'WARNING',
        message: `Could not read video logs: ${err.message}`,
        details: { error: err.message }
      });
    }

    // Count video events
    const playbackStarted = videoEvents.filter(e =>
      e.message.toLowerCase().includes('video playback started')
    );
    const videoQueued = videoEvents.filter(e =>
      e.message.toLowerCase().includes('video queued') ||
      e.message.toLowerCase().includes('queued')
    );

    // Check session transactions for video token scans
    const transactions = session.transactions || [];
    const videoTokenScans = [];

    for (const tx of transactions) {
      if (tx.status !== 'accepted') continue;

      const tokenId = tx.tokenId;
      const hasVideo = videoTokens.has(tokenId);

      if (hasVideo) {
        videoTokenScans.push({
          tokenId,
          teamId: tx.teamId,
          deviceId: tx.deviceId,
          deviceType: tx.deviceType,
          timestamp: tx.timestamp
        });
      }
    }

    // Report findings
    findings.push({
      severity: 'INFO',
      message: `Video token database: ${videoTokens.size} tokens have video assets`,
      details: { count: videoTokens.size }
    });

    findings.push({
      severity: 'INFO',
      message: `Video events in logs: ${playbackStarted.length} playback started, ${videoQueued.length} queued`,
      details: {
        playbackStarted: playbackStarted.length,
        queued: videoQueued.length
      }
    });

    findings.push({
      severity: 'INFO',
      message: `Video token scans in session: ${videoTokenScans.length}`,
      details: {
        count: videoTokenScans.length,
        scans: videoTokenScans.slice(0, 10) // Limit to first 10
      }
    });

    // Check for potential issues
    // Issue: Video tokens scanned but no playback events
    if (videoTokenScans.length > 0 && playbackStarted.length === 0) {
      status = 'WARNING';
      findings.push({
        severity: 'WARNING',
        message: 'Video tokens were scanned but no playback events found in logs',
        details: {
          videoTokenScans: videoTokenScans.length,
          possibleCauses: [
            'VLC not connected',
            'FEATURE_VIDEO_PLAYBACK=false',
            'Logs rotated/archived',
            'GM scans (do not trigger video)'
          ]
        }
      });
    }

    // Issue: More playback events than video token scans
    if (playbackStarted.length > videoTokenScans.length + 5) {
      findings.push({
        severity: 'INFO',
        message: 'More playback events than video token scans (may include idle loop or manual plays)',
        details: {
          playbackEvents: playbackStarted.length,
          videoTokenScans: videoTokenScans.length
        }
      });
    }

    // Check for VLC errors
    const vlcErrors = videoEvents.filter(e =>
      e.level === 'error' ||
      e.message.toLowerCase().includes('vlc error') ||
      e.message.toLowerCase().includes('vlc disconnected')
    );

    if (vlcErrors.length > 0) {
      status = 'WARNING';
      findings.push({
        severity: 'WARNING',
        message: `Found ${vlcErrors.length} VLC-related errors`,
        details: {
          count: vlcErrors.length,
          samples: vlcErrors.slice(0, 5).map(e => e.message)
        }
      });
    }

    return {
      name: this.name,
      status,
      findings,
      summary: {
        videoTokensInDB: videoTokens.size,
        videoTokenScans: videoTokenScans.length,
        playbackStartedEvents: playbackStarted.length,
        queuedEvents: videoQueued.length,
        vlcErrors: vlcErrors.length
      }
    };
  }
}

module.exports = VideoPlaybackCheck;
