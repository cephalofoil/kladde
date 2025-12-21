"use client";

/**
 * Utility functions for exporting Mermaid diagrams as images
 */

interface ExportOptions {
  filename?: string;
  format?: 'png' | 'jpeg';
  quality?: number; // 0-1 for JPEG quality
  scale?: number; // Scale factor for higher resolution
  debug?: boolean; // Enable debug logging
}

/**
 * Alternative SVG to Canvas conversion using foreignObject
 */
async function svgToCanvasAlternative(svgString: string, options: ExportOptions = {}): Promise<HTMLCanvasElement> {
  const { scale = 2, debug = false } = options;

  return new Promise((resolve, reject) => {
    try {
      // Parse SVG to get dimensions
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = svgString.trim();
      const svgElement = tempDiv.querySelector('svg');
      
      if (!svgElement) {
        reject(new Error('Invalid SVG content - no SVG element found'));
        return;
      }

      const viewBox = svgElement.getAttribute('viewBox');
      let width: number, height: number;
      
      if (viewBox) {
        const [, , vbWidth, vbHeight] = viewBox.split(' ').map(Number);
        width = vbWidth || 800;
        height = vbHeight || 600;
      } else {
        width = Number(svgElement.getAttribute('width')) || 800;
        height = Number(svgElement.getAttribute('height')) || 600;
      }

      const scaledWidth = Math.round(width * scale);
      const scaledHeight = Math.round(height * scale);

      // Create a canvas
      const canvas = document.createElement('canvas');
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Set white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, scaledWidth, scaledHeight);

      // Create an SVG with foreignObject containing the original SVG
      const wrapperSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${scaledWidth}" height="${scaledHeight}" viewBox="0 0 ${scaledWidth} ${scaledHeight}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="transform: scale(${scale}); transform-origin: top left; width: ${width}px; height: ${height}px;">
              ${svgString}
            </div>
          </foreignObject>
        </svg>
      `;

      const img = new Image();
      const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(wrapperSvg)}`;
      
      img.onload = () => {
        try {
          ctx.drawImage(img, 0, 0);
          if (debug) {
            console.log('Alternative method: Successfully drew SVG to canvas');
          }
          resolve(canvas);
        } catch (drawError) {
          reject(new Error(`Alternative method failed to draw: ${drawError}`));
        }
      };
      
      img.onerror = () => {
        reject(new Error('Alternative method: Failed to load SVG'));
      };
      
      img.src = svgDataUrl;

    } catch (error) {
      reject(new Error(`Alternative method parsing error: ${error}`));
    }
  });
}

/**
 * Converts an SVG string to a canvas element
 */
async function svgToCanvas(svgString: string, options: ExportOptions = {}): Promise<HTMLCanvasElement> {
  const { scale = 2, debug = false } = options; // Default to 2x for better quality
  
  // Try the primary method first
  try {
    return await svgToCanvasPrimary(svgString, options);
  } catch (error) {
    if (debug) {
      console.log('Primary method failed, trying alternative:', error);
    }
    
    // Try alternative method as final fallback
    return await svgToCanvasAlternative(svgString, options);
  }
}

/**
 * Primary SVG to Canvas conversion method
 */
async function svgToCanvasPrimary(svgString: string, options: ExportOptions = {}): Promise<HTMLCanvasElement> {
  const { scale = 2, debug = false } = options;
  
  return new Promise((resolve, reject) => {
    try {
      // Clean and parse the SVG
      const cleanSvg = svgString.trim();
      
      // Create a temporary div to parse the SVG
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = cleanSvg;
      const svgElement = tempDiv.querySelector('svg');
      
      if (!svgElement) {
        reject(new Error('Invalid SVG content - no SVG element found'));
        return;
      }

      // Ensure SVG has proper dimensions
      let width: number;
      let height: number;
      
      // Try to get dimensions from viewBox first, then from width/height attributes
      const viewBox = svgElement.getAttribute('viewBox');
      if (viewBox) {
        const [, , vbWidth, vbHeight] = viewBox.split(' ').map(Number);
        width = vbWidth || 800;
        height = vbHeight || 600;
      } else {
        width = Number(svgElement.getAttribute('width')) || 800;
        height = Number(svgElement.getAttribute('height')) || 600;
      }
      
      // Set explicit dimensions on SVG if they're missing
      if (!svgElement.getAttribute('width')) {
        svgElement.setAttribute('width', width.toString());
      }
      if (!svgElement.getAttribute('height')) {
        svgElement.setAttribute('height', height.toString());
      }
      if (!svgElement.getAttribute('viewBox')) {
        svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
      }
      
      // Ensure xmlns is set
      if (!svgElement.getAttribute('xmlns')) {
        svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      }
      
      const scaledWidth = Math.round(width * scale);
      const scaledHeight = Math.round(height * scale);

      if (debug) {
        console.log('SVG Export Debug:', {
          originalSvgLength: svgString.length,
          width,
          height,
          scale,
          scaledWidth,
          scaledHeight,
          hasViewBox: !!viewBox
        });
      }

      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Set white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, scaledWidth, scaledHeight);
      
      // Get the updated SVG string
      const updatedSvgString = svgElement.outerHTML;
      
      // Use data URL instead of blob URL to avoid CORS taint
      const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(updatedSvgString)}`;
      
      if (debug) {
        console.log('SVG Data URL length:', svgDataUrl.length);
      }
      
      // Create image and draw to canvas
      const img = new Image();
      
      img.onload = () => {
        try {
          ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
          if (debug) {
            console.log('Successfully drew SVG to canvas');
          }
          resolve(canvas);
        } catch (drawError) {
          reject(new Error(`Failed to draw image to canvas: ${drawError}`));
        }
      };
      
      img.onerror = (error) => {
        reject(new Error(`Failed to load SVG as image: ${error}`));
      };
      
      // Add a timeout to prevent hanging
      setTimeout(() => {
        reject(new Error('SVG loading timeout'));
      }, 10000);
      
      img.src = svgDataUrl;
      
    } catch (error) {
      reject(new Error(`SVG parsing error: ${error}`));
    }
  });
}

/**
 * Converts canvas to blob
 */
async function canvasToBlob(canvas: HTMLCanvasElement, options: ExportOptions = {}): Promise<Blob> {
  const { format = 'png', quality = 0.9 } = options;
  
  return new Promise((resolve, reject) => {
    try {
      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      
      // Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        reject(new Error('Canvas to blob conversion timeout'));
      }, 5000);
      
      canvas.toBlob((blob) => {
        clearTimeout(timeout);
        if (blob && blob.size > 0) {
          if (options.debug) {
            console.log('Successfully created blob:', { size: blob.size, type: blob.type });
          }
          resolve(blob);
        } else {
          reject(new Error(`Failed to convert canvas to blob. Canvas dimensions: ${canvas.width}x${canvas.height}, mimeType: ${mimeType}`));
        }
      }, mimeType, quality);
      
    } catch (error) {
      reject(new Error(`Canvas to blob error: ${error}`));
    }
  });
}

/**
 * Downloads a blob as a file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copies an image to the clipboard
 */
async function copyImageToClipboard(blob: Blob): Promise<void> {
  if (!navigator.clipboard || !navigator.clipboard.write) {
    throw new Error('Clipboard API not supported');
  }

  const clipboardItem = new ClipboardItem({ [blob.type]: blob });
  await navigator.clipboard.write([clipboardItem]);
}

/**
 * Exports SVG as an image file
 */
export async function exportSvgAsImage(
  svgString: string, 
  options: ExportOptions = {}
): Promise<void> {
  const { filename = 'mermaid-diagram', format = 'png' } = options;
  
  try {
    const canvas = await svgToCanvas(svgString, options);
    const blob = await canvasToBlob(canvas, options);
    const fileExtension = format === 'jpeg' ? 'jpg' : 'png';
    downloadBlob(blob, `${filename}.${fileExtension}`);
  } catch (error) {
    console.error('Failed to export SVG as image:', error);
    
    // Provide a more user-friendly error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Export failed: ${errorMessage}. Please try again or check your browser's permissions.`);
  }
}

/**
 * Copies SVG as an image to clipboard
 */
export async function copySvgAsImage(
  svgString: string, 
  options: ExportOptions = {}
): Promise<void> {
  try {
    const canvas = await svgToCanvas(svgString, options);
    const blob = await canvasToBlob(canvas, { ...options, format: 'png' }); // Always use PNG for clipboard
    await copyImageToClipboard(blob);
  } catch (error) {
    console.error('Failed to copy SVG as image:', error);
    
    // Provide a more user-friendly error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('Clipboard API not supported')) {
      throw new Error('Your browser does not support copying images to clipboard. Please try downloading instead.');
    } else {
      throw new Error(`Copy failed: ${errorMessage}. Please try again or use download instead.`);
    }
  }
}

/**
 * Generates a filename based on the current date and time
 */
export function generateMermaidFilename(): string {
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
  return `mermaid-diagram-${timestamp}`;
}
