export function getMagicWandMask(
  imageData: ImageData,
  startX: number,
  startY: number,
  tolerance: number = 30
): Uint8Array {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  const getPixelPos = (x: number, y: number) => (y * width + x) * 4;

  const startPos = getPixelPos(startX, startY);
  const startR = data[startPos];
  const startG = data[startPos + 1];
  const startB = data[startPos + 2];
  const startA = data[startPos + 3];

  const visited = new Uint8Array(width * height);
  if (startA === 0) return visited; // return empty mask if clicking on transparent

  const matchColor = (pos: number) => {
    const r = data[pos];
    const g = data[pos + 1];
    const b = data[pos + 2];
    const a = data[pos + 3];

    // if already transparent, ignore
    if (a === 0) return false;

    const rDiff = Math.abs(r - startR);
    const gDiff = Math.abs(g - startG);
    const bDiff = Math.abs(b - startB);
    const aDiff = Math.abs(a - startA);

    return rDiff <= tolerance && gDiff <= tolerance && bDiff <= tolerance && aDiff <= tolerance;
  };

  const pixelStack: [number, number][] = [[startX, startY]];

  while (pixelStack.length > 0) {
    const [x, y] = pixelStack.pop()!;
    const pos = getPixelPos(x, y);

    if (visited[y * width + x]) continue;
    visited[y * width + x] = 1;

    if (matchColor(pos)) {
      if (x > 0) pixelStack.push([x - 1, y]);
      if (x < width - 1) pixelStack.push([x + 1, y]);
      if (y > 0) pixelStack.push([x, y - 1]);
      if (y < height - 1) pixelStack.push([x, y + 1]);
    } else {
      // not a match, unmark visited so we don't treat it as highlighted
      visited[y * width + x] = 0;
    }
  }

  return visited;
}
