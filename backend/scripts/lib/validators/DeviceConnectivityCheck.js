/**
 * DeviceConnectivityCheck - Verify device health throughout session
 *
 * Analyzes log events for:
 * - WebSocket connections established
 * - GM station authentications
 * - sync:full events sent
 * - Device disconnections
 */

class DeviceConnectivityCheck {
  constructor(logParser) {
    this.logParser = logParser;
    this.name = 'Device Connectivity';
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

    // Get connectivity events from logs
    let connectivityEvents = [];
    try {
      connectivityEvents = await this.logParser.findDeviceConnectivityEvents(sessionStart, sessionEnd);
    } catch (err) {
      findings.push({
        severity: 'WARNING',
        message: `Could not read connectivity logs: ${err.message}`,
        details: { error: err.message }
      });
      return {
        name: this.name,
        status: 'WARNING',
        findings,
        summary: {}
      };
    }

    // Categorize events
    const connections = connectivityEvents.filter(e =>
      e.message.toLowerCase().includes('websocket connection') ||
      e.message.toLowerCase().includes('device:connected')
    );

    const authentications = connectivityEvents.filter(e =>
      e.message.toLowerCase().includes('gm station authenticated') ||
      e.message.toLowerCase().includes('authenticated')
    );

    const syncs = connectivityEvents.filter(e =>
      e.message.toLowerCase().includes('sync:full') ||
      e.message.toLowerCase().includes('sent full sync')
    );

    const disconnections = connectivityEvents.filter(e =>
      e.message.toLowerCase().includes('disconnected') ||
      e.message.toLowerCase().includes('device:disconnected')
    );

    // Report statistics
    findings.push({
      severity: 'INFO',
      message: `Connection events: ${connections.length} connections, ${authentications.length} authentications`,
      details: {
        connections: connections.length,
        authentications: authentications.length
      }
    });

    findings.push({
      severity: 'INFO',
      message: `State sync events: ${syncs.length} sync:full broadcasts`,
      details: { syncs: syncs.length }
    });

    findings.push({
      severity: 'INFO',
      message: `Disconnection events: ${disconnections.length}`,
      details: { disconnections: disconnections.length }
    });

    // Check for potential issues
    // Issue: Many disconnections relative to connections
    if (disconnections.length > connections.length) {
      findings.push({
        severity: 'WARNING',
        message: 'More disconnections than connections (may indicate unstable network)',
        details: {
          connections: connections.length,
          disconnections: disconnections.length
        }
      });
      if (status === 'PASS') status = 'WARNING';
    }

    // Issue: No connections at all
    if (connections.length === 0) {
      findings.push({
        severity: 'WARNING',
        message: 'No device connections found in logs during session',
        details: {
          possibleCauses: [
            'Logs rotated/archived',
            'Session ran without devices',
            'Log time filtering mismatch'
          ]
        }
      });
      if (status === 'PASS') status = 'WARNING';
    }

    // Issue: No sync:full events (devices may have stale state)
    if (syncs.length === 0 && connections.length > 0) {
      findings.push({
        severity: 'WARNING',
        message: 'No sync:full events found (devices may not have received state)',
        details: { note: 'sync:full should be sent after each connection' }
      });
      if (status === 'PASS') status = 'WARNING';
    }

    // Analyze session devices if available
    const sessionDevices = session.devices || [];
    if (sessionDevices.length > 0) {
      findings.push({
        severity: 'INFO',
        message: `Session has ${sessionDevices.length} registered device(s)`,
        details: {
          devices: sessionDevices.map(d => ({
            id: d.id || d.deviceId,
            type: d.type || d.deviceType,
            name: d.name
          }))
        }
      });
    }

    return {
      name: this.name,
      status,
      findings,
      summary: {
        connections: connections.length,
        authentications: authentications.length,
        syncs: syncs.length,
        disconnections: disconnections.length,
        sessionDevices: sessionDevices.length
      }
    };
  }
}

module.exports = DeviceConnectivityCheck;
