# Log Archival Script - Usage Guide

This script archives log entries older than 2 weeks (configurable) into separate files organized by scan date.

## Features

- **Smart Timestamp Detection**: Automatically detects various timestamp formats including:
  - ISO 8601 (2024-12-08T14:30:45)
  - Standard format (2024-12-08 14:30:45)
  - Bracketed timestamps ([2024-12-08 14:30:45])
  - Unix timestamps
  - JSON logs with timestamp fields

- **Date-Organized Archives**: Archives are named by date (e.g., `scan_2024-11-15.log`)

- **Safe Processing**: 
  - Preserves lines without timestamps
  - Keeps active logs clean and manageable
  - Creates archive directory automatically

- **Flexible Options**: Configure retention period, archive location, and file patterns

## Basic Usage

```bash
python archive_logs.py X:\projects\AboutLastNight\ALN-Ecosystem\backend\logs
```

This will:
- Archive entries older than 14 days (default)
- Store archives in `X:\projects\AboutLastNight\ALN-Ecosystem\backend\logs\archive`
- Process all `*.log` files

## Advanced Options

### Specify Custom Archive Location
```bash
python archive_logs.py X:\path\to\logs --archive-dir X:\path\to\archives
```

### Change Retention Period
```bash
# Keep 30 days instead of 14
python archive_logs.py X:\path\to\logs --days 30

# Keep only 7 days
python archive_logs.py X:\path\to\logs --days 7
```

### Process Specific File Pattern
```bash
# Process only scan logs
python archive_logs.py X:\path\to\logs --pattern "scan*.log"

# Process all .txt files
python archive_logs.py X:\path\to\logs --pattern "*.txt"
```

### Dry Run (Preview)
```bash
# See what would happen without making changes
python archive_logs.py X:\path\to\logs --dry-run
```

## Complete Example

```bash
python archive_logs.py X:\projects\AboutLastNight\ALN-Ecosystem\backend\logs \
    --days 21 \
    --pattern "*.log" \
    --archive-dir X:\projects\AboutLastNight\ALN-Ecosystem\backend\logs\archive
```

## Output Example

```
🗃️  Log Archival Tool
📁 Logs directory: X:\projects\AboutLastNight\ALN-Ecosystem\backend\logs
📦 Archive directory: X:\projects\AboutLastNight\ALN-Ecosystem\backend\logs\archive
📅 Cutoff date: 2024-11-24 10:30:00
   (archiving entries older than 2024-11-24)
======================================================================

Found 3 log file(s)

Processing: scan_log.log
  📦 Archived 145 lines to scan_log_2024-11-15.log
  📦 Archived 203 lines to scan_log_2024-11-20.log
  ✅ Kept 89 recent lines in scan_log.log

Processing: token_events.log
  📦 Archived 67 lines to token_events_2024-11-18.log
  ✅ Kept 34 recent lines in token_events.log

======================================================================
✨ Archival complete!
📊 Total lines archived: 415
📊 Total lines kept: 123
📦 Archive location: X:\projects\AboutLastNight\ALN-Ecosystem\backend\logs\archive
```

## Archive File Organization

Archives are organized by original filename and date:

```
logs/
├── archive/
│   ├── scan_log_2024-11-15.log
│   ├── scan_log_2024-11-20.log
│   ├── scan_log_2024-11-22.log
│   ├── token_events_2024-11-18.log
│   └── system_2024-11-21.log
├── scan_log.log (recent entries only)
├── token_events.log (recent entries only)
└── system.log (recent entries only)
```

## Automation with Task Scheduler

To run this automatically on Windows:

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (e.g., weekly)
4. Action: Start a Program
   - Program: `python`
   - Arguments: `C:\path\to\archive_logs.py X:\projects\AboutLastNight\ALN-Ecosystem\backend\logs`

## Requirements

- Python 3.6 or higher
- No external dependencies (uses only standard library)

## Safety Notes

- The script creates backups by moving old data to archives
- Original log files are rewritten with only recent data
- Lines without timestamps are preserved with their nearest timestamped entry
- Run with `--dry-run` first to preview changes

## Troubleshooting

**Problem**: "No log files found"
- Check that the path is correct
- Ensure files match the pattern (default: `*.log`)

**Problem**: "Skipping - binary or non-UTF8 file"
- The script only processes text files
- Binary logs need a different approach

**Problem**: Lines aren't being archived
- Check that timestamps are in a recognized format
- The script shows which files it's processing
- Use `--dry-run` to verify file detection

## Support

For issues or questions about the About Last Night project, contact the StoryPunk team.
