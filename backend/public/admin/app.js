/**
 * Admin Panel JavaScript Application
 * Handles all admin panel functionality including authentication,
 * session management, video controls, and real-time monitoring
 */

class AdminPanel {
  constructor() {
    this.token = null;
    this.socket = null;
    this.currentSession = null;
    this.isConnected = false;
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.checkExistingAuth();
  }

  setupEventListeners() {
    // Login form
    document.getElementById('loginForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.login();
    });

    // Logout button
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
      this.logout();
    });

    // Session controls
    document.getElementById('createSessionBtn')?.addEventListener('click', () => {
      this.showCreateSessionModal();
    });

    document.getElementById('pauseSessionBtn')?.addEventListener('click', () => {
      this.controlSession('pause');
    });

    document.getElementById('resumeSessionBtn')?.addEventListener('click', () => {
      this.controlSession('resume');
    });

    document.getElementById('endSessionBtn')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to end the session?')) {
        this.controlSession('end');
      }
    });

    // Video controls
    document.getElementById('playVideoBtn')?.addEventListener('click', () => {
      this.controlVideo('play');
    });

    document.getElementById('pauseVideoBtn')?.addEventListener('click', () => {
      this.controlVideo('pause');
    });

    document.getElementById('stopVideoBtn')?.addEventListener('click', () => {
      this.controlVideo('stop');
    });

    document.getElementById('skipVideoBtn')?.addEventListener('click', () => {
      this.controlVideo('skip');
    });

    // Team scores
    document.getElementById('resetScoresBtn')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all team scores?')) {
        this.resetScores();
      }
    });

    // Transactions
    document.getElementById('clearTransactionsBtn')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear transaction history?')) {
        this.clearTransactions();
      }
    });

    // Emergency controls
    document.getElementById('stopAllVideosBtn')?.addEventListener('click', () => {
      this.stopAllVideos();
    });

    document.getElementById('forceOfflineBtn')?.addEventListener('click', () => {
      this.toggleOfflineMode();
    });

    document.getElementById('resetSystemBtn')?.addEventListener('click', () => {
      if (confirm('WARNING: This will reset the entire system. Continue?')) {
        this.resetSystem();
      }
    });

    // Session modal
    document.getElementById('createSessionForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.createSession();
    });

    document.getElementById('cancelSessionBtn')?.addEventListener('click', () => {
      this.hideCreateSessionModal();
    });
  }

  checkExistingAuth() {
    const savedToken = localStorage.getItem('adminToken');
    if (savedToken) {
      this.token = savedToken;
      this.showDashboard();
      this.connectWebSocket();
      this.loadCurrentState();
    }
  }

  async login() {
    const password = document.getElementById('adminPassword').value;
    const errorDiv = document.getElementById('loginError');

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        this.token = data.token;
        localStorage.setItem('adminToken', this.token);
        errorDiv.textContent = '';
        this.showDashboard();
        this.connectWebSocket();
        this.loadCurrentState();
      } else {
        errorDiv.textContent = data.message || 'Login failed';
      }
    } catch (error) {
      errorDiv.textContent = 'Connection error';
      console.error('Login error:', error);
    }
  }

  logout() {
    this.token = null;
    localStorage.removeItem('adminToken');
    if (this.socket) {
      this.socket.disconnect();
    }
    this.showLogin();
  }

  showLogin() {
    document.getElementById('loginScreen').classList.add('active');
    document.getElementById('adminDashboard').classList.remove('active');
  }

  showDashboard() {
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('adminDashboard').classList.add('active');
  }

  connectWebSocket() {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io({
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.updateConnectionStatus('Connected');

      // Identify as admin
      this.socket.emit('admin:identify', {
        token: this.token,
      });

      // Also identify as GM for compatibility
      this.socket.emit('gm:identify', {
        stationId: 'ADMIN_PANEL',
        version: '1.0.0',
      });
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      this.isConnected = false;
      this.updateConnectionStatus('Disconnected');
    });

    // Listen for real-time updates
    this.socket.on('session:new', (data) => {
      this.logActivity(`New session created: ${data.name}`);
      this.loadCurrentState();
    });

    this.socket.on('session:update', (data) => {
      this.logActivity(`Session ${data.status}`);
      this.updateSessionInfo(data);
    });

    this.socket.on('transaction:new', (data) => {
      this.addTransaction(data);
      this.loadScores();
    });

    this.socket.on('state:update', (data) => {
      this.updateState(data);
    });

    this.socket.on('state:sync', (data) => {
      this.syncState(data);
    });

    this.socket.on('video:status', (data) => {
      this.updateVideoStatus(data);
    });

    this.socket.on('device:connected', (data) => {
      this.logActivity(`Device connected: ${data.deviceId}`);
      this.updateDeviceList();
    });

    this.socket.on('device:disconnected', (data) => {
      this.logActivity(`Device disconnected: ${data.deviceId}`);
      this.updateDeviceList();
    });
  }

  updateConnectionStatus(status) {
    const statusEl = document.getElementById('connectionStatus');
    if (statusEl) {
      statusEl.textContent = status;
      statusEl.className = status === 'Connected' ? 'status connected' : 'status disconnected';
    }
  }

  async loadCurrentState() {
    try {
      // Load current session
      const sessionResponse = await fetch('/api/session', {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (sessionResponse.ok) {
        const data = await sessionResponse.json();
        if (data.session || data.id) {
          this.currentSession = data.session || data;
          this.updateSessionInfo(this.currentSession);
        }
      }

      // Load current state
      const stateResponse = await fetch('/api/state');
      if (stateResponse.ok) {
        const data = await stateResponse.json();
        this.syncState(data.state || data);
      }

      // Load system status
      const healthResponse = await fetch('/health');
      if (healthResponse.ok) {
        const health = await healthResponse.json();
        this.updateSystemStatus(health);
      }
    } catch (error) {
      console.error('Failed to load state:', error);
    }
  }

  updateSessionInfo(session) {
    document.getElementById('sessionId').textContent = session.id || '-';
    document.getElementById('sessionName').textContent = session.name || '-';
    
    const statusEl = document.getElementById('sessionStatus');
    if (statusEl) {
      statusEl.textContent = session.status || '-';
      statusEl.className = `status-badge ${session.status || ''}`;
    }

    // Update button states
    const isPaused = session.status === 'paused';
    const isActive = session.status === 'active';
    
    document.getElementById('pauseSessionBtn').disabled = !isActive;
    document.getElementById('resumeSessionBtn').disabled = !isPaused;
  }

  updateVideoStatus(data) {
    document.getElementById('videoStatus').textContent = data.status || 'Idle';
    
    if (data.tokenId) {
      document.getElementById('currentVideo').textContent = data.tokenId;
    }
    
    if (data.status === 'completed' || data.status === 'stopped') {
      document.getElementById('currentVideo').textContent = 'None';
    }
    
    this.logActivity(`Video ${data.status}: ${data.tokenId || 'N/A'}`);
  }

  updateSystemStatus(health) {
    const updateIndicator = (id, status) => {
      const el = document.getElementById(id);
      if (el) {
        el.className = status ? 'status-indicator online' : 'status-indicator offline';
      }
    };

    updateIndicator('orchestratorStatus', health.status === 'healthy');
    updateIndicator('vlcStatus', health.services?.vlc);
    updateIndicator('displayStatus', health.services?.videoDisplay);
    updateIndicator('offlineMode', health.offlineMode);
  }

  syncState(state) {
    if (!state) return;

    // Update scores
    if (state.scores) {
      this.updateScores(state.scores);
    }

    // Update recent transactions
    if (state.recentTransactions) {
      this.updateTransactionsList(state.recentTransactions);
    }

    // Update video queue
    if (state.videoQueue) {
      document.getElementById('queueLength').textContent = state.videoQueue.length || 0;
    }

    // Update connected devices
    if (state.connectedDevices) {
      this.updateDeviceCounts(state.connectedDevices);
    }
  }

  updateState(delta) {
    // Handle incremental state updates
    if (delta.scores) {
      this.updateScores(delta.scores);
    }
    
    if (delta.transaction) {
      this.addTransaction(delta.transaction);
    }
    
    if (delta.videoQueue) {
      document.getElementById('queueLength').textContent = delta.videoQueue.length || 0;
    }
  }

  updateScores(scores) {
    const container = document.getElementById('teamScoresList');
    if (!container) return;

    container.innerHTML = '';
    
    scores.forEach(score => {
      const scoreEl = document.createElement('div');
      scoreEl.className = 'score-item';
      scoreEl.innerHTML = `
        <span class="team-name">${score.teamId}</span>
        <span class="team-score">${score.currentScore || 0}</span>
      `;
      container.appendChild(scoreEl);
    });
  }

  updateTransactionsList(transactions) {
    const container = document.getElementById('transactionsList');
    if (!container) return;

    container.innerHTML = '';
    
    transactions.slice(0, 10).forEach(tx => {
      const txEl = document.createElement('div');
      txEl.className = 'transaction-item';
      txEl.innerHTML = `
        <span class="tx-team">${tx.teamId}</span>
        <span class="tx-token">${tx.tokenId}</span>
        <span class="tx-points">+${tx.points}</span>
      `;
      container.appendChild(txEl);
    });
  }

  addTransaction(tx) {
    const container = document.getElementById('transactionsList');
    if (!container) return;

    const txEl = document.createElement('div');
    txEl.className = 'transaction-item new';
    txEl.innerHTML = `
      <span class="tx-team">${tx.teamId}</span>
      <span class="tx-token">${tx.tokenId}</span>
      <span class="tx-points">+${tx.points}</span>
    `;
    
    container.insertBefore(txEl, container.firstChild);
    
    // Remove oldest if too many
    while (container.children.length > 10) {
      container.removeChild(container.lastChild);
    }
    
    // Remove 'new' class after animation
    setTimeout(() => txEl.classList.remove('new'), 1000);
  }

  updateDeviceCounts(devices) {
    const gmCount = devices.filter(d => d.type === 'gm').length;
    const playerCount = devices.filter(d => d.type === 'player').length;
    const scannerCount = devices.filter(d => d.type === 'scanner').length;
    
    document.getElementById('gmStationCount').textContent = gmCount;
    document.getElementById('playerCount').textContent = playerCount;
    document.getElementById('scannerCount').textContent = scannerCount;
    
    this.updateDeviceList(devices);
  }

  updateDeviceList(devices) {
    const container = document.getElementById('deviceList');
    if (!container) return;

    container.innerHTML = '';
    
    if (!devices || devices.length === 0) {
      container.innerHTML = '<div class="no-devices">No devices connected</div>';
      return;
    }
    
    devices.forEach(device => {
      const deviceEl = document.createElement('div');
      deviceEl.className = `device-item ${device.connectionStatus}`;
      deviceEl.innerHTML = `
        <span class="device-type">${device.type}</span>
        <span class="device-id">${device.id}</span>
        <span class="device-status">${device.connectionStatus}</span>
      `;
      container.appendChild(deviceEl);
    });
  }

  logActivity(message) {
    const container = document.getElementById('activityLog');
    if (!container) return;

    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    const timestamp = new Date().toLocaleTimeString();
    logEntry.innerHTML = `<span class="log-time">${timestamp}</span> ${message}`;
    
    container.insertBefore(logEntry, container.firstChild);
    
    // Keep only last 50 entries
    while (container.children.length > 50) {
      container.removeChild(container.lastChild);
    }
  }

  showCreateSessionModal() {
    document.getElementById('sessionModal').classList.add('active');
  }

  hideCreateSessionModal() {
    document.getElementById('sessionModal').classList.remove('active');
    document.getElementById('createSessionForm').reset();
  }

  async createSession() {
    const name = document.getElementById('newSessionName').value;
    const checkboxes = document.querySelectorAll('#createSessionForm input[type="checkbox"]:checked');
    const teams = Array.from(checkboxes).map(cb => cb.value);

    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({ name, teams }),
      });

      if (response.ok) {
        const data = await response.json();
        this.currentSession = data.session || data;
        this.updateSessionInfo(this.currentSession);
        this.hideCreateSessionModal();
        this.logActivity(`Created session: ${name}`);
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to create session');
      }
    } catch (error) {
      console.error('Create session error:', error);
      alert('Failed to create session');
    }
  }

  async controlSession(action) {
    let status;
    switch (action) {
      case 'pause':
        status = 'paused';
        break;
      case 'resume':
        status = 'active';
        break;
      case 'end':
        status = 'completed';
        break;
      default:
        return;
    }

    try {
      const response = await fetch('/api/session', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        const data = await response.json();
        this.currentSession = data.session || data;
        this.updateSessionInfo(this.currentSession);
        this.logActivity(`Session ${action}d`);
      } else {
        const error = await response.json();
        alert(error.message || `Failed to ${action} session`);
      }
    } catch (error) {
      console.error(`Session ${action} error:`, error);
      alert(`Failed to ${action} session`);
    }
  }

  async controlVideo(command) {
    try {
      const response = await fetch('/api/video/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({ command, action: command }),
      });

      if (response.ok) {
        const data = await response.json();
        this.logActivity(`Video ${command} successful`);
        
        if (data.currentStatus) {
          this.updateVideoStatus({ status: data.currentStatus });
        }
      } else {
        const error = await response.json();
        alert(error.message || `Failed to ${command} video`);
      }
    } catch (error) {
      console.error(`Video ${command} error:`, error);
      alert(`Failed to ${command} video`);
    }
  }

  async resetScores() {
    try {
      const response = await fetch('/api/admin/reset-scores', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (response.ok) {
        this.logActivity('Scores reset');
        this.loadCurrentState();
      } else if (response.status === 404) {
        // Fallback: manually reset through state
        alert('Score reset endpoint not available');
      }
    } catch (error) {
      console.error('Reset scores error:', error);
    }
  }

  async clearTransactions() {
    try {
      const response = await fetch('/api/admin/clear-transactions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (response.ok) {
        this.logActivity('Transaction history cleared');
        document.getElementById('transactionsList').innerHTML = '';
      } else if (response.status === 404) {
        // Fallback: clear display only
        document.getElementById('transactionsList').innerHTML = '';
        this.logActivity('Transaction display cleared');
      }
    } catch (error) {
      console.error('Clear transactions error:', error);
    }
  }

  async stopAllVideos() {
    try {
      const response = await fetch('/api/admin/stop-all-videos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (response.ok) {
        this.logActivity('All videos stopped');
        this.updateVideoStatus({ status: 'stopped' });
      } else if (response.status === 404) {
        // Fallback: use regular stop
        await this.controlVideo('stop');
      }
    } catch (error) {
      console.error('Stop all videos error:', error);
    }
  }

  async toggleOfflineMode() {
    const currentMode = document.getElementById('offlineMode').classList.contains('online');
    const newMode = !currentMode;

    try {
      const response = await fetch('/api/admin/offline-mode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({ enabled: newMode }),
      });

      if (response.ok) {
        this.logActivity(`Offline mode ${newMode ? 'enabled' : 'disabled'}`);
        document.getElementById('offlineMode').className = newMode ? 'status-indicator online' : 'status-indicator offline';
      } else if (response.status === 404) {
        alert('Offline mode control not available');
      }
    } catch (error) {
      console.error('Toggle offline mode error:', error);
    }
  }

  async resetSystem() {
    try {
      // End current session
      await this.controlSession('end');
      
      // Clear all data
      await this.clearTransactions();
      await this.resetScores();
      await this.stopAllVideos();
      
      this.logActivity('System reset complete');
      
      // Reload state
      setTimeout(() => this.loadCurrentState(), 1000);
    } catch (error) {
      console.error('System reset error:', error);
      alert('Failed to reset system');
    }
  }

  async loadScores() {
    try {
      const response = await fetch('/api/state');
      if (response.ok) {
        const data = await response.json();
        if (data.state?.scores || data.scores) {
          this.updateScores(data.state?.scores || data.scores);
        }
      }
    } catch (error) {
      console.error('Load scores error:', error);
    }
  }

  async updateDeviceList() {
    try {
      const response = await fetch('/api/state');
      if (response.ok) {
        const data = await response.json();
        if (data.state?.connectedDevices || data.connectedDevices) {
          this.updateDeviceCounts(data.state?.connectedDevices || data.connectedDevices);
        }
      }
    } catch (error) {
      console.error('Update device list error:', error);
    }
  }
}

// Initialize admin panel when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.adminPanel = new AdminPanel();
});