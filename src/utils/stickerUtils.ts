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
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        const rawMat = cv.matFromImageData(imgData);
        
        // Downscale to max 1024px to prevent WASM OOM and reduce noise
        const MAX_DIM = 1024;
        const scale = Math.min(MAX_DIM / img.width, MAX_DIM / img.height, 1);
        const pWidth = Math.round(img.width * scale);
        const pHeight = Math.round(img.height * scale);
        
        const mat = new cv.Mat();
        cv.resize(rawMat, mat, new cv.Size(pWidth, pHeight), 0, 0, cv.INTER_AREA);
        rawMat.delete();
        
        // Use alpha channel if available and has variation, else fallback to Canny edge detection
        const channels = new cv.MatVector();
        cv.split(mat, channels);
        let useAlpha = false;
        
        let edges = new cv.Mat();
        
        if (channels.size() === 4) {
          const alpha = channels.get(3);
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
          cv.dilate(edges, edges, M, new cv.Point(-1, -1), dilationIterations);
          M.delete();
        }

        // Find contours
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        const rects: StickerRect[] = [];
        const minArea = (mat.cols * mat.rows) * minAreaRatio; // Ignore very small contours (e.g. noise)

        for (let i = 0; i < contours.size(); ++i) {
          const contour = contours.get(i);
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
        }
        
        // Cleanup
        mat.delete();
        edges.delete();
        contours.delete();
        hierarchy.delete();
        
        resolve(rects);
      } catch (err) {
        console.error("OpenCV error:", err);
        reject(err);
      }
    };
    img.onerror = reject;
  });
}
