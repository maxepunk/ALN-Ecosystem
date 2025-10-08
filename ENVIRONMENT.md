# ALN Orchestrator Environment Documentation

## Hardware Specifications

### Raspberry Pi Details
- **Model**: Raspberry Pi 4 Model B Rev 1.5
- **Architecture**: ARM64 (aarch64)
- **CPU**: 4-core ARM Cortex-A72 @ 1.8GHz
  - ARM 64-bit enabled
  - Features: fp, asimd, evtstrm, crc32, cpuid
  - Boost enabled (arm_boost=1)

### Memory
- **Total RAM**: 8GB (8,008,548 KB)
- **Available Memory**: ~6.5GB typically available
- **Swap**: 512MB swap file at `/var/swap`
- **Swappiness**: 60 (default)

### Storage
- **Root Filesystem**: 6.8GB SD card (96% used - 289MB free)
  - Device: /dev/mmcblk0p2 (ext4)
  - Critical: Low disk space warning
- **Boot Partition**: /dev/mmcblk0p1 (FAT32)
  - Mounted at: /boot/firmware

## Operating System

### Distribution
- **OS**: Debian GNU/Linux 12 (bookworm)
- **Kernel**: 6.12.47+rpt-rpi-v8 (Debian 1:6.12.47-1+rpt1~bookworm)
- **Build Date**: September 16, 2025
- **Hostname**: aln-orchestrator

### System Limits
- **Open Files**: 1,048,576 (max)
- **Stack Size**: 8MB
- **User Processes**: 29,145 (max)
- **Core Dumps**: Disabled
- **Memory Locking**: ~1GB limit

## Network Configuration

### Primary Interface
- **Interface**: eth0 (Ethernet)
- **IPv4 Address**: 10.0.0.176/24
- **IPv6 Support**: Enabled
- **State**: UP and ACTIVE

### Network Services
- **SSH**: Active (systemd service)
- **Network Manager**: systemd-networkd (active)
- **Discovery Port**: UDP 8888 (for auto-discovery)

## Display & Audio

### Display Configuration
- **GPU Driver**: vc4-kms-v3d (KMS/DRM enabled)
- **GPU Memory**: 256MB (required for hardware-accelerated video decoding)
- **HDMI Boost**: Level 5 (config_hdmi_boost=5)
- **Display Output**: Currently headless (no framebuffer devices)
  - Note: tvservice not available (Wayland/KMS mode)

### Audio Devices
- **HDMI Audio 0**: vc4-hdmi-0 (card 0)
- **HDMI Audio 1**: vc4-hdmi-1 (card 1)
- **3.5mm Jack**: bcm2835 Headphones (card 2)
- **PulseAudio**: Running with PipeWire backend
- **Default Sink**: Built-in Audio Stereo (86% volume)

### Boot Configuration (/boot/firmware/config.txt)
```
dtparam=audio=on
dtoverlay=vc4-kms-v3d
dtoverlay=dwc2,dr_mode=host
gpu_mem=256
```

## Software Environment

### Node.js & NPM
- **Node.js Version**: v20.19.5
- **NPM Version**: 10.8.2
- **Global Packages**:
  - pm2@6.0.13 (Process Manager)
  - @anthropic-ai/claude-code@1.0.128
- **Registry**: https://registry.npmjs.org/

### VLC Media Player
- **Version**: 3.0.21 Vetinari
- **Compiled**: September 10, 2025 (Debian arm64 build)
- **Compiler**: gcc 12.2.0
- **HTTP Interface**: Port 8080 (password: vlc)

### Multimedia Libraries
- **FFmpeg**: 5.1.7-0+deb12u1+rpt1
- **GStreamer**: 1.22.0 (full plugin set)
  - Base, Good, Bad plugins installed
  - Hardware acceleration support (GL)
  - ALSA audio support

## Process Management (PM2)

### Active Processes
1. **aln-orchestrator**
   - PID: Variable (currently 13342)
   - Memory: ~74MB
   - Restarts: 2
   - Status: Online

2. **vlc-http**
   - PID: Variable (currently 11874)
   - Memory: ~155MB
   - Restarts: 0
   - Status: Online

## Performance Characteristics

### Current Status
- **CPU Throttling**: None (throttled=0x0)
- **CPU Usage**: Low (~0% idle)
- **Memory Usage**: ~1.1GB used of 8GB
- **Temperature**: Within normal range (no throttling)

### Optimization Notes
- Core frequency: 500MHz (min: 200MHz)
- Audio PWM mode: 514
- Camera auto-detect enabled
- Auto initramfs enabled

## Critical Considerations

### Storage Warning
⚠️ **Root filesystem is 96% full** - Only 289MB free space remaining
- Consider cleanup or expansion
- May affect video storage and logs

### Memory Management
- Node.js heap limit set to 256MB (--max-old-space-size=256)
- Suitable for Raspberry Pi constraints
- PM2 manages process restarts on memory issues

### Network Requirements
- System requires network access for scanner connections
- UDP port 8888 must be available for discovery
- HTTP port 3000 for orchestrator API
- HTTP port 8080 for VLC control

### Missing Dependency
- Package `concurrently@^8.2.0` not installed
- Required for development scripts
- Run `npm install` to fix

## Recommended Actions

1. **Free Disk Space**: Clean up logs and temporary files
2. **Install Missing Dependencies**: Run `cd backend && npm install`
3. **Monitor Temperature**: Ensure adequate cooling for 24/7 operation
4. **Consider Storage Expansion**: Larger SD card or USB storage for videos

## Service URLs

- **Orchestrator API**: http://10.0.0.176:3000
- **Admin Panel**: http://10.0.0.176:3000/admin/
- **Player Scanner**: http://10.0.0.176:3000/player-scanner/
- **GM Scanner**: http://10.0.0.176:3000/gm-scanner/
- **VLC Control**: http://10.0.0.176:8080 (password: vlc)

## Last Updated
October 7, 2025 - Updated GPU memory allocation to 256MB for video playback optimization