import React, { useRef, useEffect, useState } from 'react';

const NeurAIDisplayGenerator = () => {
  const canvasRef = useRef(null);
  const [text, setText] = useState("9:20PM - Howie overhears Jessicah begging for some time to talk to Marcus privately to no avail, and offers her some kindness, and a cup of some water.");
  const [previewScale, setPreviewScale] = useState(2);

  const WIDTH = 240;
  const HEIGHT = 320;

  const drawToCanvas = (canvas, inputText) => {
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    
    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    // Add subtle red glow border
    ctx.strokeStyle = 'rgba(204, 0, 0, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, WIDTH - 2, HEIGHT - 2);
    
    // NeurAI ASCII Logo (top corner)
    ctx.fillStyle = 'rgba(204, 0, 0, 0.4)';
    ctx.font = 'bold 10px monospace';
    const logo = [
      '███╗░░██╗',
      '████╗░██║',
      '██╔██╗██║',
      '██║╚████║',
      '██║░╚███║',
      '╚═╝░░╚══╝'
    ];
    logo.forEach((line, i) => {
      ctx.fillText(line, WIDTH - 70, 12 + i * 9);
    });
    
    // Red accent line below logo
    ctx.strokeStyle = '#cc0000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, 65);
    ctx.lineTo(WIDTH - 10, 65);
    ctx.stroke();
    
    // Text rendering
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    // Use monospace for cyberpunk aesthetic
    const fontSize = 13;
    const lineHeight = 18;
    const padding = 15;
    const maxWidth = WIDTH - (padding * 2);
    const startY = 75;
    
    ctx.font = `${fontSize}px monospace`;
    
    // Word wrap function
    const wrapText = (text, maxWidth) => {
      const words = text.split(' ');
      const lines = [];
      let currentLine = '';
      
      words.forEach(word => {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      });
      
      if (currentLine) {
        lines.push(currentLine);
      }
      
      return lines;
    };
    
    const lines = wrapText(inputText, maxWidth);
    const maxLines = Math.floor((HEIGHT - startY - 40) / lineHeight);
    const displayLines = lines.slice(0, maxLines);
    
    // Draw each line with slight red glow
    displayLines.forEach((line, i) => {
      const y = startY + (i * lineHeight);
      
      // Glow effect
      ctx.shadowColor = 'rgba(204, 0, 0, 0.5)';
      ctx.shadowBlur = 3;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(line, padding, y);
      
      // Reset shadow
      ctx.shadowBlur = 0;
    });
    
    // Add truncation indicator if text was cut off
    if (lines.length > maxLines) {
      ctx.fillStyle = 'rgba(204, 0, 0, 0.8)';
      ctx.font = `bold 11px monospace`;
      ctx.fillText('[...]', padding, startY + (maxLines * lineHeight) + 5);
    }
    
    // Bottom NeurAI branding
    ctx.fillStyle = 'rgba(204, 0, 0, 0.6)';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('N E U R A I', WIDTH / 2, HEIGHT - 25);
    
    // Scanline effect (subtle)
    ctx.fillStyle = 'rgba(204, 0, 0, 0.05)';
    for (let y = 0; y < HEIGHT; y += 4) {
      ctx.fillRect(0, y, WIDTH, 1);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      drawToCanvas(canvas, text);
    }
  }, [text]);

  const downloadBMP = () => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, WIDTH, HEIGHT);
      
      // BMP row size must be a multiple of 4 bytes
      const bytesPerPixel = 3; // 24-bit RGB
      const rowSize = Math.floor((WIDTH * bytesPerPixel + 3) / 4) * 4;
      const pixelArraySize = rowSize * HEIGHT;
      const fileSize = 54 + pixelArraySize;
      
      const buffer = new ArrayBuffer(fileSize);
      const view = new DataView(buffer);
      
      // BMP Header (14 bytes)
      view.setUint8(0, 0x42); // 'B'
      view.setUint8(1, 0x4D); // 'M'
      view.setUint32(2, fileSize, true); // File size
      view.setUint32(6, 0, true); // Reserved
      view.setUint32(10, 54, true); // Pixel data offset
      
      // DIB Header (40 bytes)
      view.setUint32(14, 40, true); // Header size
      view.setInt32(18, WIDTH, true); // Width
      view.setInt32(22, HEIGHT, true); // Height
      view.setUint16(26, 1, true); // Planes
      view.setUint16(28, 24, true); // Bits per pixel
      view.setUint32(30, 0, true); // Compression (none)
      view.setUint32(34, pixelArraySize, true); // Image size
      view.setInt32(38, 2835, true); // X pixels per meter
      view.setInt32(42, 2835, true); // Y pixels per meter
      view.setUint32(46, 0, true); // Colors in palette
      view.setUint32(50, 0, true); // Important colors
      
      // Pixel data (bottom to top, BGR format)
      const pixels = new Uint8Array(buffer, 54);
      let pixelIndex = 0;
      
      for (let y = HEIGHT - 1; y >= 0; y--) {
        for (let x = 0; x < WIDTH; x++) {
          const i = (y * WIDTH + x) * 4;
          pixels[pixelIndex++] = imageData.data[i + 2]; // B
          pixels[pixelIndex++] = imageData.data[i + 1]; // G
          pixels[pixelIndex++] = imageData.data[i];     // R
        }
        // Row padding
        const padding = rowSize - (WIDTH * bytesPerPixel);
        for (let p = 0; p < padding; p++) {
          pixels[pixelIndex++] = 0;
        }
      }
      
      // Download
      const blob = new Blob([buffer], { type: 'image/bmp' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'neurai-display.bmp';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating BMP:', error);
      alert('Error generating BMP file. Please try again.');
    }
  };

  const charCount = text.length;
  const maxRecommended = 180;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#ffffff',
      padding: '2rem',
      fontFamily: 'monospace'
    }}>
      <div style={{
        maxWidth: '900px',
        margin: '0 auto'
      }}>
        <h1 style={{
          color: '#cc0000',
          textTransform: 'uppercase',
          fontSize: '2rem',
          marginBottom: '0.5rem',
          textShadow: '0 0 20px rgba(204, 0, 0, 0.5)'
        }}>
          NeurAI Display Generator
        </h1>
        <p style={{
          color: 'rgba(255, 255, 255, 0.7)',
          marginBottom: '2rem',
          fontSize: '0.9rem'
        }}>
          240x320 BMP for 2.8" Embedded Display
        </p>

        <div style={{
          marginBottom: '2rem'
        }}>
          <label style={{
            display: 'block',
            color: 'rgba(255, 255, 255, 0.9)',
            textTransform: 'uppercase',
            fontSize: '0.9rem',
            marginBottom: '0.5rem'
          }}>
            Message Text
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{
              width: '100%',
              minHeight: '120px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '2px solid rgba(204, 0, 0, 0.3)',
              color: '#ffffff',
              padding: '1rem',
              fontFamily: 'monospace',
              fontSize: '0.95rem',
              borderRadius: '4px',
              resize: 'vertical'
            }}
            placeholder="Enter display text..."
          />
          <div style={{
            marginTop: '0.5rem',
            fontSize: '0.85rem',
            color: charCount > maxRecommended ? '#cc0000' : 'rgba(255, 255, 255, 0.6)'
          }}>
            {charCount} characters {charCount > maxRecommended && `(${charCount - maxRecommended} over recommended)`}
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '2rem',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={downloadBMP}
            style={{
              background: 'transparent',
              border: '2px solid #cc0000',
              color: '#ffffff',
              padding: '1rem 2rem',
              textTransform: 'uppercase',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              fontFamily: 'monospace'
            }}
            onMouseOver={(e) => {
              e.target.style.background = 'rgba(204, 0, 0, 0.2)';
              e.target.style.boxShadow = '0 0 20px rgba(204, 0, 0, 0.5)';
            }}
            onMouseOut={(e) => {
              e.target.style.background = 'transparent';
              e.target.style.boxShadow = 'none';
            }}
          >
            Download BMP
          </button>

          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '0.85rem'
          }}>
            Preview Scale:
            <input
              type="range"
              min="1"
              max="3"
              step="0.5"
              value={previewScale}
              onChange={(e) => setPreviewScale(parseFloat(e.target.value))}
              style={{
                accentColor: '#cc0000'
              }}
            />
            {previewScale}x
          </label>
        </div>

        <div style={{
          border: '2px solid rgba(204, 0, 0, 0.3)',
          padding: '2rem',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '4px',
          display: 'inline-block'
        }}>
          <div style={{
            marginBottom: '1rem',
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '0.85rem',
            textTransform: 'uppercase'
          }}>
            Preview (240x320px)
          </div>
          <canvas
            ref={canvasRef}
            style={{
              border: '1px solid rgba(204, 0, 0, 0.5)',
              imageRendering: 'pixelated',
              transform: `scale(${previewScale})`,
              transformOrigin: 'top left',
              boxShadow: '0 0 30px rgba(204, 0, 0, 0.3)'
            }}
          />
        </div>

        <div style={{
          marginTop: '2rem',
          padding: '1.5rem',
          background: 'rgba(204, 0, 0, 0.1)',
          border: '1px solid rgba(204, 0, 0, 0.3)',
          borderRadius: '4px',
          fontSize: '0.85rem',
          color: 'rgba(255, 255, 255, 0.8)'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
            Display Specs
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
            <li>Resolution: 240x320 pixels (vertical)</li>
            <li>Format: 24-bit BMP</li>
            <li>Color Scheme: NeurAI Cyberpunk (#cc0000 / #0a0a0a)</li>
            <li>Font: Monospace 13px with red glow</li>
            <li>Recommended: ~180 characters max for readability</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default NeurAIDisplayGenerator;
