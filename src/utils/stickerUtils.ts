import rawCv from '@techstark/opencv-js';

// OpenCV.js exports a Promise-like object that must be awaited for WASM initialization
const getCv = async (): Promise<any> => {
  if (typeof (rawCv as any).then === 'function') {
    return await (rawCv as any);
  }
  return rawCv;
};

export interface StickerRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export async function extractStickers(
  imageUrl: string, 
  dilationIterations: number = 1, 
  minAreaRatio: number = 0.005
): Promise<StickerRect[]> {
  const cv = await getCv();

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      const cleanupList: any[] = [];
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        const rawMat = cv.matFromImageData(imgData);
        cleanupList.push(rawMat);
        
        // Downscale to max 1024px to prevent WASM OOM and reduce noise
        const MAX_DIM = 1024;
        const scale = Math.min(MAX_DIM / img.width, MAX_DIM / img.height, 1);
        const pWidth = Math.round(img.width * scale);
        const pHeight = Math.round(img.height * scale);
        
        const mat = new cv.Mat();
        cleanupList.push(mat);
        cv.resize(rawMat, mat, new cv.Size(pWidth, pHeight), 0, 0, cv.INTER_AREA);
        rawMat.delete();
        
        // Use alpha channel if available and has variation, else fallback to Canny edge detection
        const channels = new cv.MatVector();
        cleanupList.push(channels);
        cv.split(mat, channels);
        let useAlpha = false;
        
        const edges = new cv.Mat();
        cleanupList.push(edges);
        
        if (channels.size() === 4) {
          const alpha = channels.get(3);
          cleanupList.push(alpha);
          const nonZero = cv.countNonZero(alpha);
          if (nonZero < alpha.rows * alpha.cols) {
             // Image has transparent areas
             cv.threshold(alpha, edges, 0, 255, cv.THRESH_BINARY);
             useAlpha = true;
          }
          alpha.delete();
        }
        
        if (!useAlpha) {
          const gray = new cv.Mat();
          cleanupList.push(gray);
          if (mat.channels() === 3) {
            cv.cvtColor(mat, gray, cv.COLOR_RGB2GRAY, 0);
          } else if (mat.channels() === 4) {
            cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY, 0);
          } else {
            mat.copyTo(gray);
          }
          // Add Gaussian blur to reduce noise in real-world photos
          cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0, 0);
          cv.Canny(gray, edges, 50, 150, 3, false);
          gray.delete();
        }
        channels.delete();
        
        // Dilate to connect edges
        if (dilationIterations > 0) {
          const M = cv.Mat.ones(5, 5, cv.CV_8U);
          cleanupList.push(M);
          cv.dilate(edges, edges, M, new cv.Point(-1, -1), dilationIterations);
        }

        // Find contours
        const contours = new cv.MatVector();
        cleanupList.push(contours);
        const hierarchy = new cv.Mat();
        cleanupList.push(hierarchy);
        cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        const rects: StickerRect[] = [];
        const minArea = (mat.cols * mat.rows) * minAreaRatio; // Ignore very small contours (e.g. noise)

        for (let i = 0; i < contours.size(); ++i) {
          const contour = contours.get(i);
          try {
            const area = cv.contourArea(contour);
            if (area > minArea) {
              const rect = cv.boundingRect(contour);
              // Add a small padding and scale back to original image coordinates
              const pad = 10;
              const x = Math.max(0, Math.floor((rect.x / scale) - pad));
              const y = Math.max(0, Math.floor((rect.y / scale) - pad));
              const w = Math.min(img.width - x, Math.ceil((rect.width / scale) + pad * 2));
              const h = Math.min(img.height - y, Math.ceil((rect.height / scale) + pad * 2));
              
              if (w > 0 && h > 0) {
                rects.push({ x, y, w, h });
              }
            }
          } finally {
            if (contour && typeof contour.delete === 'function') {
              contour.delete();
            }
          }
        }
        resolve(rects);
      } catch (err) {
        console.error("OpenCV error:", err);
        reject(err);
      } finally {
        for (const obj of cleanupList) {
          try {
            if (obj && typeof obj.delete === 'function') {
              obj.delete();
            }
          } catch {
            // Ignore double deletes
          }
        }
      }
    };
    img.onerror = reject;
  });
}

/**
 * Applies a custom color & thickness outline to any transparent PNG / image URL.
 */
export async function applyCustomOutline(
  url: string, 
  outlineColor: string = '#ffffff', 
  outlineWidth: number = 10
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = url;
    img.onload = () => {
      const padding = outlineWidth;
      const canvas = document.createElement('canvas');
      canvas.width = img.width + padding * 2;
      canvas.height = img.height + padding * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(url);

      // 1. Dilate alpha mask by drawing the image in a radial circle
      const steps = Math.max(32, outlineWidth * 2);
      for (let i = 0; i < steps; i++) {
        const angle = (Math.PI * 2 * i) / steps;
        const dx = Math.cos(angle) * padding;
        const dy = Math.sin(angle) * padding;
        ctx.drawImage(img, padding + dx, padding + dy);
      }
      
      // 2. Color the dilated mask
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = outlineColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // 3. Draw the original image centered on top
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(img, padding, padding);
      
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(url);
  });
}

/**
 * Trims transparent whitespace around an image on a canvas.
 */
export function trimCanvasTransparentMargins(canvas: HTMLCanvasElement): HTMLCanvasElement | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 5) { // threshold for non-transparent pixels
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Entirely transparent image or already fitted
  if (maxX === -1 || maxY === -1) return null;

  const trimWidth = maxX - minX + 1;
  const trimHeight = maxY - minY + 1;

  const trimmedCanvas = document.createElement('canvas');
  trimmedCanvas.width = trimWidth;
  trimmedCanvas.height = trimHeight;
  const trimmedCtx = trimmedCanvas.getContext('2d');
  if (!trimmedCtx) return null;

  trimmedCtx.drawImage(
    canvas,
    minX, minY, trimWidth, trimHeight,
    0, 0, trimWidth, trimHeight
  );

  return trimmedCanvas;
}

/**
 * Restores any foreground character artwork that was accidentally hollowed out or erased by AI background removal.
 * Uses corner background color sampling and flood fill from the original image to detect the true sticker sheet background.
 */
export async function fillAlphaHoles(
  segmentedUrl: string,
  originalUrl: string,
  colorTolerance: number = 35
): Promise<string> {
  return new Promise((resolve) => {
    const segImg = new Image();
    const origImg = new Image();
    let loadedCount = 0;

    const onBothLoaded = () => {
      const width = segImg.width;
      const height = segImg.height;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(segmentedUrl);

      // 1. Draw original unsegmented image to temp canvas
      const origCanvas = document.createElement('canvas');
      origCanvas.width = width;
      origCanvas.height = height;
      const origCtx = origCanvas.getContext('2d');
      if (!origCtx) return resolve(segmentedUrl);
      origCtx.drawImage(origImg, 0, 0, width, height);
      const origData = origCtx.getImageData(0, 0, width, height);

      // 2. Draw segmented image
      ctx.drawImage(segImg, 0, 0, width, height);
      const segData = ctx.getImageData(0, 0, width, height);

      // 3. Sample corner colors from original image to find the true sticker sheet background
      const getOrigColor = (x: number, y: number) => {
        const p = (y * width + x) * 4;
        return {
          r: origData.data[p],
          g: origData.data[p + 1],
          b: origData.data[p + 2],
          a: origData.data[p + 3]
        };
      };

      const corners = [
        getOrigColor(0, 0),
        getOrigColor(width - 1, 0),
        getOrigColor(0, height - 1),
        getOrigColor(width - 1, height - 1)
      ];

      const isSheetBackground = new Uint8Array(width * height);
      const queue: [number, number, { r: number; g: number; b: number; a: number }][] = [];

      const cornerCoords: [number, number, number][] = [
        [0, 0, 0],
        [width - 1, 0, 1],
        [0, height - 1, 2],
        [width - 1, height - 1, 3]
      ];

      for (const [cx, cy, cIdx] of cornerCoords) {
        const idx = cy * width + cx;
        if (!isSheetBackground[idx]) {
          isSheetBackground[idx] = 1;
          queue.push([cx, cy, corners[cIdx]]);
        }
      }

      const isBgMatch = (x: number, y: number, bg: { r: number; g: number; b: number; a: number }) => {
        const p = (y * width + x) * 4;
        const r = origData.data[p];
        const g = origData.data[p + 1];
        const b = origData.data[p + 2];
        const a = origData.data[p + 3];

        if (a <= 10) return true;
        if (bg.a <= 10) return a <= 10;

        return Math.abs(r - bg.r) <= colorTolerance &&
               Math.abs(g - bg.g) <= colorTolerance &&
               Math.abs(b - bg.b) <= colorTolerance;
      };

      let head = 0;
      while (head < queue.length) {
        const [cx, cy, bg] = queue[head++];

        const neighbors: [number, number][] = [
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1]
        ];

        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = ny * width + nx;
            if (!isSheetBackground[nIdx] && isBgMatch(nx, ny, bg)) {
              isSheetBackground[nIdx] = 1;
              queue.push([nx, ny, bg]);
            }
          }
        }
      }

      // 4. Restore any pixel in the segmented image that is NOT sheet background
      let restoredCount = 0;
      for (let i = 0; i < width * height; i++) {
        const p = i * 4;
        const currentAlpha = segData.data[p + 3];
        const origAlpha = origData.data[p + 3];

        // If erased on segmented canvas but is foreground in the original image
        if (currentAlpha < 200 && !isSheetBackground[i] && origAlpha > 15) {
          segData.data[p] = origData.data[p];
          segData.data[p + 1] = origData.data[p + 1];
          segData.data[p + 2] = origData.data[p + 2];
          segData.data[p + 3] = origData.data[p + 3];
          restoredCount++;
        }
      }

      if (restoredCount > 0) {
        ctx.putImageData(segData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        resolve(segmentedUrl);
      }
    };

    segImg.onload = () => {
      loadedCount++;
      if (loadedCount === 2) onBothLoaded();
    };
    origImg.onload = () => {
      loadedCount++;
      if (loadedCount === 2) onBothLoaded();
    };
    segImg.onerror = () => resolve(segmentedUrl);
    origImg.onerror = () => resolve(segmentedUrl);

    segImg.src = segmentedUrl;
    origImg.src = originalUrl;
  });
}

/**
 * Restores artwork in-place on a canvas from an original image.
 */
export function fillCanvasHoles(
  canvas: HTMLCanvasElement, 
  originalImg: HTMLImageElement,
  colorTolerance: number = 35
): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const width = canvas.width;
  const height = canvas.height;

  // 1. Draw original to temp canvas
  const origCanvas = document.createElement('canvas');
  origCanvas.width = width;
  origCanvas.height = height;
  const origCtx = origCanvas.getContext('2d');
  if (!origCtx) return false;
  origCtx.drawImage(originalImg, 0, 0, width, height);
  const origData = origCtx.getImageData(0, 0, width, height);

  const segData = ctx.getImageData(0, 0, width, height);

  // 2. Sample corner colors from original image
  const getOrigColor = (x: number, y: number) => {
    const p = (y * width + x) * 4;
    return {
      r: origData.data[p],
      g: origData.data[p + 1],
      b: origData.data[p + 2],
      a: origData.data[p + 3]
    };
  };

  const corners = [
    getOrigColor(0, 0),
    getOrigColor(width - 1, 0),
    getOrigColor(0, height - 1),
    getOrigColor(width - 1, height - 1)
  ];

  const isSheetBackground = new Uint8Array(width * height);
  const queue: [number, number, { r: number; g: number; b: number; a: number }][] = [];

  const cornerCoords: [number, number, number][] = [
    [0, 0, 0],
    [width - 1, 0, 1],
    [0, height - 1, 2],
    [width - 1, height - 1, 3]
  ];

  for (const [cx, cy, cIdx] of cornerCoords) {
    const idx = cy * width + cx;
    if (!isSheetBackground[idx]) {
      isSheetBackground[idx] = 1;
      queue.push([cx, cy, corners[cIdx]]);
    }
  }

  const isBgMatch = (x: number, y: number, bg: { r: number; g: number; b: number; a: number }) => {
    const p = (y * width + x) * 4;
    const r = origData.data[p];
    const g = origData.data[p + 1];
    const b = origData.data[p + 2];
    const a = origData.data[p + 3];

    if (a <= 10) return true;
    if (bg.a <= 10) return a <= 10;

    return Math.abs(r - bg.r) <= colorTolerance &&
           Math.abs(g - bg.g) <= colorTolerance &&
           Math.abs(b - bg.b) <= colorTolerance;
  };

  let head = 0;
  while (head < queue.length) {
    const [cx, cy, bg] = queue[head++];

    const neighbors: [number, number][] = [
      [cx - 1, cy],
      [cx + 1, cy],
      [cx, cy - 1],
      [cx, cy + 1]
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nIdx = ny * width + nx;
        if (!isSheetBackground[nIdx] && isBgMatch(nx, ny, bg)) {
          isSheetBackground[nIdx] = 1;
          queue.push([nx, ny, bg]);
        }
      }
    }
  }

  let changed = false;
  for (let i = 0; i < width * height; i++) {
    const p = i * 4;
    const currentAlpha = segData.data[p + 3];
    const origAlpha = origData.data[p + 3];

    if (currentAlpha < 200 && !isSheetBackground[i] && origAlpha > 15) {
      segData.data[p] = origData.data[p];
      segData.data[p + 1] = origData.data[p + 1];
      segData.data[p + 2] = origData.data[p + 2];
      segData.data[p + 3] = origData.data[p + 3];
      changed = true;
    }
  }

  if (changed) {
    ctx.putImageData(segData, 0, 0);
  }
  return changed;
}

