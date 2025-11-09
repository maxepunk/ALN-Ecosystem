#!/usr/bin/env python3
"""
NeurAI Display Generator - Python Implementation

Generates 240x320px BMP images for ESP32-CYD player scanner display.
Replicates the NeurAI cyberpunk aesthetic from neurai-display-generator.jsx

Usage:
    from neurai_display_generator import generate_neurai_display
    generate_neurai_display("token123", "Summary text here", "/path/to/output.bmp")
"""

from PIL import Image, ImageDraw, ImageFont
import struct
from pathlib import Path

# Display dimensions
WIDTH = 240
HEIGHT = 320

# Color scheme
COLOR_BG = (10, 10, 10)  # #0a0a0a
COLOR_RED = (204, 0, 0)  # #cc0000
COLOR_RED_ALPHA_30 = (204, 0, 0, 76)  # rgba(204, 0, 0, 0.3)
COLOR_RED_ALPHA_40 = (204, 0, 0, 102)  # rgba(204, 0, 0, 0.4)
COLOR_RED_ALPHA_60 = (204, 0, 0, 153)  # rgba(204, 0, 0, 0.6)
COLOR_RED_ALPHA_80 = (204, 0, 0, 204)  # rgba(204, 0, 0, 0.8)
COLOR_WHITE = (255, 255, 255)
COLOR_SCANLINE = (204, 0, 0, 13)  # rgba(204, 0, 0, 0.05)


def draw_neurai_n_logo(draw, x, y):
    """
    Draw simplified NeurAI 'N' logo with horizontal lines pattern.
    Moderate complexity - inspired by NeurAI.png

    Args:
        draw: PIL ImageDraw object
        x: Top-left x coordinate
        y: Top-left y coordinate
    """
    # Logo is approximately 60px wide x 50px tall
    # Using horizontal lines to form an 'N' shape

    # N logo using horizontal lines with varying lengths
    # Left vertical bar
    for i in range(0, 45, 3):
        line_y = y + i
        draw.line([(x, line_y), (x + 8, line_y)], fill=COLOR_RED_ALPHA_40, width=1)

    # Diagonal connecting lines (creates the N diagonal)
    for i in range(0, 45, 4):
        line_y = y + i
        line_x_start = x + 10 + int(i * 0.6)
        line_x_end = line_x_start + 6 + int(i * 0.15)
        draw.line([(line_x_start, line_y), (line_x_end, line_y)], fill=COLOR_RED_ALPHA_40, width=1)

    # Right vertical bar
    for i in range(0, 45, 3):
        line_y = y + i
        draw.line([(x + 52, line_y), (x + 60, line_y)], fill=COLOR_RED_ALPHA_40, width=1)

    # Add some accent dots for "neural" effect
    dot_positions = [
        (x + 5, y + 10), (x + 20, y + 20), (x + 35, y + 30),
        (x + 55, y + 15), (x + 40, y + 35)
    ]
    for dot_x, dot_y in dot_positions:
        draw.ellipse([(dot_x - 1, dot_y - 1), (dot_x + 1, dot_y + 1)],
                     fill=COLOR_RED_ALPHA_60)


def wrap_text(text, font, max_width, draw):
    """
    Wrap text to fit within max_width pixels.

    Args:
        text: String to wrap
        font: PIL ImageFont object
        max_width: Maximum width in pixels
        draw: PIL ImageDraw object (needed for textbbox)

    Returns:
        List of wrapped lines
    """
    words = text.split(' ')
    lines = []
    current_line = ''

    for word in words:
        test_line = current_line + (' ' if current_line else '') + word

        # Get bounding box for the test line
        bbox = draw.textbbox((0, 0), test_line, font=font)
        text_width = bbox[2] - bbox[0]

        if text_width > max_width and current_line:
            lines.append(current_line)
            current_line = word
        else:
            current_line = test_line

    if current_line:
        lines.append(current_line)

    return lines


def generate_neurai_display(rfid, summary_text, output_path):
    """
    Generate a NeurAI-styled BMP display image.

    Args:
        rfid: Token RFID identifier (for logging)
        summary_text: Text content to display
        output_path: Path where BMP file should be saved

    Returns:
        True if successful, False otherwise
    """
    try:
        # Create image with RGBA for transparency effects
        img = Image.new('RGBA', (WIDTH, HEIGHT), COLOR_BG + (255,))
        draw = ImageDraw.Draw(img)

        # Background
        draw.rectangle([(0, 0), (WIDTH, HEIGHT)], fill=COLOR_BG + (255,))

        # Subtle red glow border
        draw.rectangle([(1, 1), (WIDTH - 2, HEIGHT - 2)],
                       outline=COLOR_RED_ALPHA_30, width=2)

        # NeurAI N logo (top-right corner)
        logo_x = WIDTH - 70
        logo_y = 5
        draw_neurai_n_logo(draw, logo_x, logo_y)

        # Red accent line below logo area
        draw.line([(10, 65), (WIDTH - 10, 65)], fill=COLOR_RED, width=2)

        # Text rendering setup
        # Use default PIL font (bitmap font, monospace-like)
        try:
            # Try to use a better font if available
            font = ImageFont.load_default()
        except:
            font = ImageFont.load_default()

        # Text parameters
        font_size = 13  # Approximate size (default font doesn't scale)
        line_height = 18
        padding = 15
        max_width = WIDTH - (padding * 2)
        start_y = 75

        # Wrap text
        lines = wrap_text(summary_text, font, max_width, draw)

        # Calculate max lines that fit
        available_height = HEIGHT - start_y - 40
        max_lines = int(available_height / line_height)
        display_lines = lines[:max_lines]

        # Draw each line with red glow effect
        for i, line in enumerate(display_lines):
            y = start_y + (i * line_height)

            # Glow effect (draw multiple times slightly offset)
            for offset in [(-1, -1), (-1, 1), (1, -1), (1, 1)]:
                draw.text((padding + offset[0], y + offset[1]),
                         line, font=font, fill=COLOR_RED_ALPHA_40)

            # Main text
            draw.text((padding, y), line, font=font, fill=COLOR_WHITE)

        # Add truncation indicator if text was cut off
        if len(lines) > max_lines:
            truncate_y = start_y + (max_lines * line_height) + 5
            draw.text((padding, truncate_y), '[...]',
                     font=font, fill=COLOR_RED_ALPHA_80)

        # Bottom NeurAI branding
        branding_text = 'N E U R A I'
        bbox = draw.textbbox((0, 0), branding_text, font=font)
        text_width = bbox[2] - bbox[0]
        branding_x = (WIDTH - text_width) // 2
        branding_y = HEIGHT - 25
        draw.text((branding_x, branding_y), branding_text,
                 font=font, fill=COLOR_RED_ALPHA_60)

        # Scanline effect (subtle)
        scanline_overlay = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
        scanline_draw = ImageDraw.Draw(scanline_overlay)
        for y in range(0, HEIGHT, 4):
            scanline_draw.line([(0, y), (WIDTH, y)], fill=COLOR_SCANLINE, width=1)

        # Composite scanlines
        img = Image.alpha_composite(img, scanline_overlay)

        # Convert to RGB for BMP export (24-bit)
        img_rgb = img.convert('RGB')

        # Save as BMP
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        img_rgb.save(output_path, format='BMP')

        print(f"✓ Generated BMP for {rfid}: {output_path}")
        return True

    except Exception as e:
        print(f"✗ Error generating BMP for {rfid}: {e}")
        return False


def generate_placeholder_bmp(output_path):
    """
    Generate the placeholder error BMP with NeurAI styling.

    Args:
        output_path: Path where placeholder.bmp should be saved

    Returns:
        True if successful, False otherwise
    """
    error_text = (
        "[ERR] MEMORY CORRUPTED. DEEP EXTRACTION REQUIRED... "
        "PLEASE CONTACT NEURAI REPRESENTATIVE."
    )

    return generate_neurai_display("placeholder", error_text, output_path)


if __name__ == "__main__":
    # Test the generator
    import sys

    # Test with sample text
    sample_text = (
        "9:20PM - Howie overhears Jessicah begging for some time to talk to "
        "Marcus privately to no avail, and offers her some kindness, and a "
        "cup of some water."
    )

    test_output = "/tmp/neurai_test.bmp"

    print("Testing NeurAI Display Generator...")
    print(f"Generating test BMP: {test_output}")

    if generate_neurai_display("test001", sample_text, test_output):
        print("\n✓ Test successful!")
        print(f"View the output at: {test_output}")
    else:
        print("\n✗ Test failed!")
        sys.exit(1)

    # Generate placeholder
    placeholder_output = "/tmp/neurai_placeholder.bmp"
    print(f"\nGenerating placeholder BMP: {placeholder_output}")

    if generate_placeholder_bmp(placeholder_output):
        print("\n✓ Placeholder generated successfully!")
        print(f"View the output at: {placeholder_output}")
    else:
        print("\n✗ Placeholder generation failed!")
        sys.exit(1)
