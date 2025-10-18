# Raspberry Pi 4 Model B (8GB) Setup Guide for ALN Orchestrator

**Target Hardware**: Raspberry Pi 4 Model B - 8GB RAM  
**Purpose**: ALN Orchestrator Backend Server  
**Created**: 2025-09-23  

## Hardware Specifications

### Raspberry Pi 4 Model B (8GB) Specs
- **CPU**: Broadcom BCM2711, Quad-core Cortex-A72 (ARM v8) 64-bit @ 1.5GHz
- **RAM**: 8GB LPDDR4-3200 (Perfect for Node.js + VLC + multiple connections)
- **Network**: Gigabit Ethernet + Dual-band WiFi (2.4/5GHz) 802.11ac
- **USB**: 2× USB 3.0, 2× USB 2.0
- **Display**: 2× micro-HDMI (4K@60Hz support for projector)
- **Power**: USB-C (3A minimum, 15W recommended)
- **Storage**: MicroSD card slot

### Required Additional Hardware
- **Power Supply**: Official Raspberry Pi USB-C 15W (5V/3A) power supply
- **Storage**: 32GB+ MicroSD card (Class 10/A1 minimum, A2 recommended)
- **Cooling**: Heatsinks + fan (recommended for 24/7 operation)
- **Display Cable**: Micro-HDMI to HDMI for projector connection
- **Ethernet Cable**: Cat5e/Cat6 for reliable network connection

## Phase 1: Initial Hardware Setup

### 1.1 Physical Assembly
```bash
1. Install heatsinks on CPU, RAM, and USB controller chips
2. Install fan case if using active cooling
3. Insert MicroSD card (we'll prepare it next)
4. Connect to network via Ethernet (recommended) or configure WiFi later
5. Connect micro-HDMI to projector/display (optional for headless setup)
6. DO NOT power on yet - prepare SD card first
```

### 1.2 Prepare MicroSD Card

**Option A: Using Raspberry Pi Imager (Recommended)**

1. Download Raspberry Pi Imager from https://www.raspberrypi.com/software/
2. Insert MicroSD card into your computer
3. Open Raspberry Pi Imager
4. Configure:
```
OS: Raspberry Pi OS (64-bit) Lite - No desktop needed for server
Storage: Select your SD card
Settings (gear icon):
  - Hostname: aln-orchestrator
  - Enable SSH: Yes (password authentication)
  - Username: pi
  - Password: [secure password]
  - Configure WiFi: (optional if not using Ethernet)
    - SSID: ALN_GAME_NET
    - Password: [wifi password]
  - Locale: Your timezone
```
4. Write the image (takes 5-10 minutes)

**Option B: Manual Setup**
```bash
# Download latest Raspberry Pi OS Lite (64-bit)
wget https://downloads.raspberrypi.org/raspios_lite_arm64/images/raspios_lite_arm64-2024-03-15/2024-03-15-raspios-bookworm-arm64-lite.img.xz

# Write to SD card (replace /dev/sdX with your SD card device)
xzcat 2024-03-15-raspios-bookworm-arm64-lite.img.xz | sudo dd of=/dev/sdX bs=4M status=progress

# Mount boot partition and enable SSH
touch /media/boot/ssh

# Configure WiFi (if needed)
cat > /media/boot/wpa_supplicant.conf << EOF
country=US
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1

network={
    ssid="ALN_GAME_NET"
    psk="your_wifi_password"
}
EOF
```

## Phase 2: First Boot & Initial Configuration

### 2.1 Power On & Connect
```bash
1. Insert prepared SD card
2. Connect Ethernet cable (if using wired)
3. Connect power supply (Pi will boot automatically)
4. Wait ~2 minutes for first boot to complete
```

### 2.2 Find Your Pi's IP Address
```bash
# From another computer on same network:

# Option 1: Use hostname (if mDNS works)
ping aln-orchestrator.local

# Option 2: Check router's DHCP client list
# Look for "raspberrypi" or MAC starting with "DC:A6:32" or "E4:5F:01"

# Option 3: Network scan
nmap -sn 192.168.1.0/24 | grep -B 2 "Raspberry Pi"

# Option 4: ARP scan
arp -a | grep -i "dc:a6:32\|e4:5f:01\|b8:27:eb"
```

### 2.3 SSH Into Your Pi
```bash
# Connect via SSH (replace with your Pi's IP)
ssh pi@192.168.1.XXX

# Or use hostname if mDNS works
ssh pi@aln-orchestrator.local

# Accept fingerprint and enter password
```

### 2.4 Initial System Update
```bash
# Update package lists and upgrade system
sudo apt update && sudo apt upgrade -y

# This takes 10-15 minutes on first run
# Reboot after major updates
sudo reboot
```

## Phase 3: Network Configuration (Static IP)

### 3.1 Configure Static IP (192.168.1.10)
```bash
# Edit dhcpcd configuration
sudo nano /etc/dhcpcd.conf

# Add at the end of file:
interface eth0
static ip_address=192.168.1.10/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8

# Also configure WiFi as backup
interface wlan0
static ip_address=192.168.1.10/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8

# Save and exit (Ctrl+X, Y, Enter)
```

### 3.2 Configure Hostname
```bash
# Set hostname
sudo hostnamectl set-hostname aln-orchestrator

# Edit hosts file
sudo nano /etc/hosts

# Replace raspberrypi with aln-orchestrator:
127.0.0.1       localhost
127.0.1.1       aln-orchestrator

# Apply network changes
sudo systemctl restart dhcpcd
```

### 3.3 Configure Firewall
```bash
# Install UFW firewall
sudo apt install ufw -y

# Configure firewall rules
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh                    # Port 22
sudo ufw allow 3000/tcp               # Orchestrator HTTP/WebSocket
sudo ufw allow 8080/tcp               # VLC HTTP interface
sudo ufw allow 5353/udp               # mDNS

# Enable firewall
sudo ufw enable
```

## Phase 4: System Optimization for 8GB Model

### 4.1 Memory & Swap Configuration
```bash
# With 8GB RAM, we can optimize memory usage

# Reduce GPU memory split (headless server doesn't need much)
sudo raspi-config nonint do_memory_split 16

# Configure swap (minimal needed with 8GB)
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile

# Set swap size (small backup only):
CONF_SWAPSIZE=1024
CONF_MAXSWAP=1024

# Restart swap
sudo dphys-swapfile setup
sudo dphys-swapfile swapon

# Verify memory
free -h
# Should show ~7.8GB available RAM
```

### 4.2 CPU Performance Configuration
```bash
# Ensure maximum CPU performance for server use
echo 'performance' | sudo tee /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor

# Make permanent
sudo apt install cpufrequtils -y
echo 'GOVERNOR="performance"' | sudo tee /etc/default/cpufrequtils
sudo systemctl restart cpufrequtils
```

### 4.3 Enable 64-bit Kernel (if not already)
```bash
# Check current kernel
uname -m
# Should show aarch64 for 64-bit

# If showing armv7l, enable 64-bit:
echo 'arm_64bit=1' | sudo tee -a /boot/config.txt
sudo reboot
```

## Phase 5: Install Node.js 18 LTS

### 5.1 Install Node.js via NodeSource
```bash
# Install Node.js 18.x repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js and npm
sudo apt install nodejs -y

# Verify installation
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x or 10.x.x

# Install build essentials for native modules
sudo apt install build-essential python3 -y
```

### 5.2 Configure npm for Pi
```bash
# Set npm cache location
npm config set cache /home/pi/.npm

# Install global packages location
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Install PM2 for process management
npm install -g pm2
```

## Phase 6: Install VLC for Video Playback

### 6.1 Install VLC
```bash
# Install VLC and codecs
sudo apt install vlc vlc-plugin-base vlc-plugin-video-output -y

# Install additional codecs for various video formats
sudo apt install ffmpeg libavcodec-extra -y
```

### 6.2 Configure VLC for HTTP Interface
```bash
# Create VLC startup script
cat > ~/start-vlc.sh << 'EOF'
#!/bin/bash

# Kill any existing VLC instances
pkill -f vlc

# Start VLC with HTTP interface
cvlc \
    --intf http \
    --http-password aln2024 \
    --http-host 0.0.0.0 \
    --http-port 8080 \
    --fullscreen \
    --no-video-title-show \
    --no-audio \
    --video-on-top \
    --no-video-deco \
    --loop \
    --playlist-autostart &

echo "VLC HTTP interface started on port 8080"
echo "Password: aln2024"
EOF

chmod +x ~/start-vlc.sh
```

### 6.3 Configure VLC for GPU Acceleration
```bash
# Enable hardware acceleration for smooth 4K playback
sudo nano /boot/config.txt

# Add/modify these lines:
gpu_mem=128                    # Increase GPU memory for video
dtoverlay=vc4-kms-v3d          # Enable GPU driver
max_framebuffers=2             # For dual display
hdmi_enable_4kp60=1            # Enable 4K@60Hz output

# Save and reboot for changes to take effect
sudo reboot
```

## Phase 7: Install ALN Orchestrator

### 7.1 Install Git and Clone Repository
```bash
# Install git
sudo apt install git -y

# Configure git (optional)
git config --global user.name "ALN Orchestrator"
git config --global user.email "aln@local"

# Clone ALN-Ecosystem with submodules
cd ~
git clone --recurse-submodules https://github.com/maxepunk/ALN-Ecosystem.git
cd ALN-Ecosystem
```

### 7.2 Install Backend Dependencies
```bash
# Navigate to backend
cd backend

# Install production dependencies
npm ci --only=production

# Create necessary directories
mkdir -p videos sessions storage logs

# Copy and configure environment file
cp .env.example .env
nano .env

# Edit with your configuration:
# ADMIN_USERNAME=admin
# ADMIN_PASSWORD=your_secure_password_here
# JWT_SECRET=generate_random_string_here
# VLC_PASSWORD=aln2024
# CORS_ORIGINS=https://yourusername.github.io
```

### 7.3 Copy Video Files
```bash
# Create videos directory and copy your video files
cd ~/ALN-Ecosystem/backend/videos

# Option 1: Copy from USB drive
# Mount USB drive
sudo mkdir /mnt/usb
sudo mount /dev/sda1 /mnt/usb
cp /mnt/usb/*.mp4 .

# Option 2: Download from network share
# scp user@computer:/path/to/videos/*.mp4 .

# Option 3: Download from cloud storage
# wget https://your-storage/video1.mp4
```

## Phase 8: Configure System Services

### 8.1 Create Orchestrator Service
```bash
# Create systemd service for orchestrator
sudo tee /etc/systemd/system/aln-orchestrator.service > /dev/null << 'EOF'
[Unit]
Description=ALN Orchestrator Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/ALN-Ecosystem/backend
ExecStartPre=/usr/bin/git submodule update --init --recursive
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=10
StandardOutput=append:/home/pi/ALN-Ecosystem/backend/logs/orchestrator.log
StandardError=append:/home/pi/ALN-Ecosystem/backend/logs/error.log
Environment=NODE_ENV=production
Environment=NODE_OPTIONS="--max-old-space-size=2048"

# Memory limits for 8GB Pi (use up to 2GB for Node)
MemoryMax=2G
MemoryHigh=1536M

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable aln-orchestrator
sudo systemctl start aln-orchestrator
```

### 8.2 Create VLC Service
```bash
# Create VLC service
sudo tee /etc/systemd/system/vlc-http.service > /dev/null << 'EOF'
[Unit]
Description=VLC HTTP Interface for ALN
After=network.target

[Service]
Type=simple
User=pi
ExecStart=/home/pi/start-vlc.sh
Restart=always
RestartSec=10
Environment=DISPLAY=:0

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable vlc-http
sudo systemctl start vlc-http
```

### 8.3 Configure Auto-start on Boot
```bash
# Create startup script
cat > ~/startup.sh << 'EOF'
#!/bin/bash

# Wait for network
sleep 10

# Start VLC
systemctl --user start vlc-http

# Ensure orchestrator is running
sudo systemctl start aln-orchestrator

# Log startup
echo "ALN services started at $(date)" >> ~/startup.log
EOF

chmod +x ~/startup.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "@reboot /home/pi/startup.sh") | crontab -
```

## Phase 9: Performance Monitoring & Maintenance

### 9.1 Install Monitoring Tools
```bash
# Install monitoring utilities
sudo apt install htop iotop ncdu -y

# Install log rotation
sudo apt install logrotate -y

# Configure log rotation for ALN
sudo tee /etc/logrotate.d/aln-orchestrator > /dev/null << 'EOF'
/home/pi/ALN-Ecosystem/backend/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 pi pi
}
EOF
```

### 9.2 Create Health Check Script
```bash
cat > ~/health-check.sh << 'EOF'
#!/bin/bash

echo "=== ALN System Health Check ==="
echo "Date: $(date)"
echo ""

# Check services
echo "Service Status:"
systemctl is-active aln-orchestrator || echo "⚠️ Orchestrator not running"
systemctl is-active vlc-http || echo "⚠️ VLC not running"

# Check memory
echo ""
echo "Memory Usage:"
free -h | grep Mem

# Check CPU temperature
echo ""
echo "CPU Temperature:"
vcgencmd measure_temp

# Check disk space
echo ""
echo "Disk Usage:"
df -h | grep -E "^/dev/root|^/dev/mmcblk0p2"

# Check network
echo ""
echo "Network Status:"
ping -c 1 192.168.1.1 > /dev/null && echo "✓ Network connected" || echo "✗ Network down"

# Check orchestrator API
echo ""
curl -s http://localhost:3000/api/status > /dev/null && echo "✓ API responding" || echo "✗ API not responding"
EOF

chmod +x ~/health-check.sh
```

### 9.3 Temperature Management
```bash
# Monitor temperature
vcgencmd measure_temp

# If running hot (>70°C), improve cooling or throttle CPU
# Check throttling status
vcgencmd get_throttled
# 0x0 = OK, other values indicate throttling

# Install fan control for temperature management
sudo apt install fancontrol lm-sensors -y
sudo sensors-detect
```

## Phase 10: Testing & Validation

### 10.1 Test Services
```bash
# Check orchestrator service
sudo systemctl status aln-orchestrator
journalctl -u aln-orchestrator -n 50

# Check VLC service
sudo systemctl status vlc-http

# Test orchestrator API
curl http://localhost:3000/api/status

# Test VLC HTTP interface
curl http://localhost:8080
```

### 10.2 Test from Another Device
```bash
# From another computer on network:

# Test orchestrator
curl http://192.168.1.10:3000/api/status

# Access admin panel
# Open browser: http://192.168.1.10:3000/admin

# Test WebSocket
wscat -c ws://192.168.1.10:3000
```

### 10.3 Performance Validation
```bash
# Monitor resource usage during operation
htop  # Check CPU and memory usage

# Run stress test
sudo apt install stress -y
stress --cpu 4 --timeout 60s  # Should handle without issues

# Check network throughput
sudo apt install iperf3 -y
iperf3 -s  # Run server mode
```

## Troubleshooting Guide

### Common Issues

**Cannot SSH to Pi**
```bash
# Ensure SSH is enabled
# Mount SD card on another computer and create:
touch /boot/ssh

# Check if Pi is on network
ping raspberrypi.local
```

**Orchestrator won't start**
```bash
# Check logs
journalctl -u aln-orchestrator -n 100

# Check Node.js installation
node --version

# Run manually to see errors
cd ~/ALN-Ecosystem/backend
node src/server.js
```

**VLC won't play videos**
```bash
# Test VLC manually
vlc --intf http --http-password aln2024 test.mp4

# Check GPU memory
vcgencmd get_mem gpu

# Check codec support
vlc --list | grep codec
```

**Out of memory errors**
```bash
# Check memory usage
free -h

# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Reduce other services
sudo systemctl stop unnecessary-service
```

**Network issues**
```bash
# Check IP configuration
ip addr show

# Test connectivity
ping 192.168.1.1

# Check firewall
sudo ufw status

# Restart networking
sudo systemctl restart dhcpcd
```

## Maintenance Schedule

### Daily
- Check service status: `systemctl status aln-orchestrator`
- Monitor temperature: `vcgencmd measure_temp`

### Weekly  
- Check disk space: `df -h`
- Review logs: `journalctl -u aln-orchestrator --since "1 week ago"`
- Update token data: `cd ~/ALN-Ecosystem && git submodule update --remote`

### Monthly
- System updates: `sudo apt update && sudo apt upgrade`
- Clean package cache: `sudo apt clean`
- Backup session data: `tar -czf backup.tar.gz ~/ALN-Ecosystem/backend/sessions`

### Before Each Event
1. Run health check: `~/health-check.sh`
2. Test video playback
3. Verify network connectivity
4. Clear old session data
5. Restart services: `sudo systemctl restart aln-orchestrator vlc-http`

## Performance Expectations

With the Raspberry Pi 4 Model B (8GB), you can expect:

- **Boot Time**: ~30 seconds to fully operational
- **API Response**: <20ms average (local network)
- **Concurrent Connections**: 20+ devices without issues
- **Memory Usage**: ~500MB for orchestrator, ~200MB for VLC
- **CPU Usage**: ~10-20% idle, 40-60% during video playback
- **Temperature**: 45-55°C with good cooling
- **Video Playback**: Smooth 1080p, acceptable 4K@30fps
- **Uptime**: Weeks/months without restart needed

## Backup & Recovery

### Create Full Backup
```bash
# Backup SD card image (from another computer)
sudo dd if=/dev/sdX of=aln-pi-backup.img bs=4M status=progress

# Compress backup
gzip aln-pi-backup.img
```

### Quick Recovery
```bash
# Keep spare SD card with working image
# Swap cards if primary fails
# Session data is preserved in backend/sessions
```

---

*This guide is optimized for the Raspberry Pi 4 Model B with 8GB RAM, which provides excellent headroom for the ALN orchestrator system. The extra RAM ensures smooth operation even with multiple concurrent connections and video playback.*