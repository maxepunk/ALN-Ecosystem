#!/usr/bin/env python3
"""
Generate NeurAI-styled placeholder.bmp

This script creates a placeholder image with NeurAI styling
for tokens that have no summary and no custom image.
"""

import sys
from pathlib import Path

# Add parent directory to path to import from sync_notion_to_tokens
sys.path.insert(0, str(Path(__file__).parent))

from sync_notion_to_tokens import generate_neurai_display, ASSETS_IMAGES, ESP32_SD_IMAGES

def main():
    print("=" * 60)
    print("Generating NeurAI-styled placeholder.bmp")
    print("=" * 60)
    print()

    # Placeholder text
    placeholder_text = "[ERR] MEMORY TOKEN CORRUPTED. DEEP EXTRACTION REQUIRED. PLEASE CONTACT NEURAI REPRESENTATIVE"

    # Generate with "placeholder" as RFID
    try:
        # Temporarily modify the function to save as placeholder.bmp
        from PIL import Image, ImageDraw, ImageFont

        WIDTH = 240
        HEIGHT = 320

        # Create image with black background
        img = Image.new('RGB', (WIDTH, HEIGHT), color='#0a0a0a')
        draw = ImageDraw.Draw(img)

        # Dynamic font sizing based on text length
        text_length = len(placeholder_text)
        if text_length > 200:
            font_size = 10  # Smaller for long text
            line_height = 15
        elif text_length > 150:
            font_size = 12
            line_height = 16
        else:
            font_size = 13
            line_height = 18

        # Try to use monospace font, fall back to default if not available
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", font_size)
            logo_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 8)  # Smaller logo
            brand_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 12)  # Smaller branding
        except:
            try:
                font = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf", font_size)
                logo_font = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf", 8)
                brand_font = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf", 12)
            except:
                font = ImageFont.load_default()
                logo_font = ImageFont.load_default()
                brand_font = ImageFont.load_default()

        # Add subtle red glow border
        border_color = (204, 0, 0, 77)
        draw.rectangle([1, 1, WIDTH - 2, HEIGHT - 2], outline=border_color, width=2)

        # NeurAI ASCII Logo (top right corner, smaller)
        logo = [
            '███╗░░██╗',
            '████╗░██║',
            '██╔██╗██║',
            '██║╚████║',
            '██║░╚███║',
            '╚═╝░░╚══╝'
        ]
        logo_color = (204, 0, 0, 102)
        for i, line in enumerate(logo):
            draw.text((WIDTH - 65, 10 + i * 7), line, fill=logo_color, font=logo_font)

        # Red accent line below logo (higher up now)
        draw.line([(10, 55), (WIDTH - 10, 55)], fill=(204, 0, 0), width=2)

        # Text rendering with word wrap
        text_color = (255, 255, 255)
        padding = 15
        max_width = WIDTH - (padding * 2)
        start_y = 62  # Start higher since logo is smaller

        # Word wrap function
        def wrap_text(text, max_width):
            words = text.split(' ')
            lines = []
            current_line = ''

            for word in words:
                test_line = current_line + (' ' if current_line else '') + word
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

        lines = wrap_text(placeholder_text, max_width)
        max_lines = int((HEIGHT - start_y - 18) / line_height)  # Reduced bottom space to 18px
        display_lines = lines[:max_lines]

        # Draw each line (clean white text, no harsh glow)
        for i, line in enumerate(display_lines):
            y = start_y + (i * line_height)
            draw.text((padding, y), line, fill=text_color, font=font)

        # Bottom NeurAI branding (smaller, tighter to bottom)
        brand_color = (204, 0, 0, 153)
        brand_text = 'N E U R A I'
        bbox = draw.textbbox((0, 0), brand_text, font=brand_font)
        brand_width = bbox[2] - bbox[0]
        brand_x = (WIDTH - brand_width) / 2
        draw.text((brand_x, HEIGHT - 16), brand_text, fill=brand_color, font=brand_font)

        # Scanline effect removed - was too prominent

        # Save to both PWA and ESP32 locations
        pwa_path = ASSETS_IMAGES / "placeholder.bmp"
        esp32_path = ESP32_SD_IMAGES / "placeholder.bmp"

        # Ensure directories exist
        pwa_path.parent.mkdir(parents=True, exist_ok=True)
        esp32_path.parent.mkdir(parents=True, exist_ok=True)

        # Save as 24-bit BMP
        img.save(pwa_path, 'BMP')
        img.save(esp32_path, 'BMP')

        print(f"✓ Generated: {pwa_path}")
        print(f"✓ Generated: {esp32_path}")
        print()
        print("=" * 60)
        print("Placeholder generation complete!")
        print("=" * 60)

    except Exception as e:
        print(f"✗ Error generating placeholder: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
