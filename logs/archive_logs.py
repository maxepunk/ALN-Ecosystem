#!/usr/bin/env python3
"""
Log Archival Script for About Last Night
Archives log entries older than 2 weeks into date-organized files.

Usage: Place this script in the logs directory and run: python archive_logs.py
"""

import os
import re
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict
import shutil

# Configuration
ARCHIVE_CUTOFF_DAYS = 14  # Archive logs older than this many days

# Log files to process
LOG_FILES = [
    "combined.log",
    "error.log",
    "out.log",
    "vlc-error.log",
    "exceptions.log",
    "rejections.log"
]

# Regex patterns for timestamp extraction
# Pattern 1: "2025-10-31 15:28:57 -07:00: {...}"
TIMESTAMP_PATTERN_1 = re.compile(r'^(\d{4}-\d{2}-\d{2}) \d{2}:\d{2}:\d{2}[^:]*:\s*')
# Pattern 2: JSON with timestamp field: {"timestamp":"2025-10-31 15:28:57.916"...}
TIMESTAMP_PATTERN_2 = re.compile(r'"timestamp":"(\d{4}-\d{2}-\d{2})')


def parse_log_date(line):
    """
    Extract the date from a log line.
    Returns a datetime.date object or None if no date found.
    """
    # Try pattern 1: timestamp at beginning of line
    match = TIMESTAMP_PATTERN_1.match(line)
    if match:
        date_str = match.group(1)
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    
    # Try pattern 2: timestamp in JSON
    match = TIMESTAMP_PATTERN_2.search(line)
    if match:
        date_str = match.group(1)
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    
    return None


def archive_log_file(log_file_path, archive_dir, cutoff_date):
    """
    Archive entries older than cutoff_date from a log file.
    Returns tuple: (archived_count, retained_count)
    """
    log_file_path = Path(log_file_path)
    
    if not log_file_path.exists():
        print(f"⚠️  Log file not found: {log_file_path.name}")
        return 0, 0
    
    # Read all lines
    print(f"📖 Reading {log_file_path.name}...")
    try:
        with open(log_file_path, 'r', encoding='utf-8', errors='replace') as f:
            lines = f.readlines()
    except Exception as e:
        print(f"❌ Error reading {log_file_path.name}: {e}")
        return 0, 0
    
    # Group lines by date for archival
    archived_by_date = defaultdict(list)
    retained_lines = []
    
    for line in lines:
        log_date = parse_log_date(line)
        
        if log_date and log_date < cutoff_date:
            # Archive this line
            archived_by_date[log_date].append(line)
        else:
            # Keep this line in the current log
            retained_lines.append(line)
    
    # Write archived entries to date-specific files
    base_name = log_file_path.stem
    archived_count = 0
    
    for date, date_lines in sorted(archived_by_date.items()):
        archive_file = Path(archive_dir) / f"{base_name}_{date.strftime('%Y-%m-%d')}.log"
        
        # Append to archive file (in case we run this multiple times)
        with open(archive_file, 'a', encoding='utf-8') as f:
            f.writelines(date_lines)
        
        archived_count += len(date_lines)
        print(f"   📦 Archived {len(date_lines):,} lines to {archive_file.name}")
    
    # Create backup of original file
    backup_path = log_file_path.with_suffix(log_file_path.suffix + '.backup')
    if archived_count > 0:
        print(f"   💾 Creating backup: {backup_path.name}")
        shutil.copy2(log_file_path, backup_path)
        
        # Write retained lines back to original file
        print(f"   ✍️  Writing {len(retained_lines):,} lines back to {log_file_path.name}")
        with open(log_file_path, 'w', encoding='utf-8') as f:
            f.writelines(retained_lines)
    
    return archived_count, len(retained_lines)


def get_file_size_mb(file_path):
    """Get file size in MB."""
    try:
        return os.path.getsize(file_path) / (1024 * 1024)
    except:
        return 0


def main():
    print("=" * 70)
    print("About Last Night - Log Archival Script")
    print("=" * 70)
    print()
    
    # Get script directory (should be logs directory)
    script_dir = Path(__file__).parent.absolute()
    archive_dir = script_dir / "archive"
    
    # Calculate cutoff date
    cutoff_date = (datetime.now() - timedelta(days=ARCHIVE_CUTOFF_DAYS)).date()
    print(f"📅 Cutoff Date: {cutoff_date} (archiving logs older than {ARCHIVE_CUTOFF_DAYS} days)")
    print(f"📁 Working Directory: {script_dir}")
    print()
    
    # Create archive directory if it doesn't exist
    archive_dir.mkdir(exist_ok=True)
    print(f"📂 Archive Directory: {archive_dir}")
    print()
    
    # Process each log file
    total_archived = 0
    total_retained = 0
    total_size_reduction = 0
    
    print("Processing log files:")
    print("-" * 70)
    
    for log_file in LOG_FILES:
        log_path = script_dir / log_file
        
        # Get original size
        original_size = get_file_size_mb(log_path)
        
        # Archive the file
        archived, retained = archive_log_file(log_path, archive_dir, cutoff_date)
        
        # Get new size
        new_size = get_file_size_mb(log_path)
        size_reduction = original_size - new_size
        
        if archived > 0:
            print(f"✅ {log_file}:")
            print(f"   Size: {original_size:.2f} MB → {new_size:.2f} MB (reduced by {size_reduction:.2f} MB)")
            print(f"   Lines: {archived:,} archived, {retained:,} retained")
            total_size_reduction += size_reduction
        else:
            print(f"⏭️  {log_file}: No old entries to archive")
        
        print()
        
        total_archived += archived
        total_retained += retained
    
    print("-" * 70)
    print("✨ Summary:")
    print(f"   Total lines archived: {total_archived:,}")
    print(f"   Total lines retained: {total_retained:,}")
    print(f"   Total size reduction: {total_size_reduction:.2f} MB")
    print(f"   Archive location: {archive_dir}")
    print()
    print("💡 Tips:")
    print("   • Backup files (.backup) have been created for safety")
    print("   • Delete backups once you've verified the archival worked correctly")
    print("   • Archived logs are organized by date in the 'archive' folder")
    print("   • You can safely run this script multiple times")
    print()
    print("=" * 70)


if __name__ == "__main__":
    main()
