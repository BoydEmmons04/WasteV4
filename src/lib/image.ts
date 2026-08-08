// Compresses an image file into a small square JPEG data URL sized for
// the tally grid buttons, so it can be stored inline on the item's
// Firestore document (no Storage bucket needed).
export function compressImageToDataUrl(file: File, size = 256, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Canvas not supported'));
        return;
      }

      // JPEG has no alpha channel, so any transparent source pixels would
      // otherwise flatten to the canvas's default transparent-black. Fill
      // white first so transparency reads as a white background instead.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);

      const scale = Math.max(size / img.width, size / img.height);
      const drawWidth = img.width * scale;
      const drawHeight = img.height * scale;
      const offsetX = (size - drawWidth) / 2;
      const offsetY = (size - drawHeight) / 2;
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not load image'));
    };
    img.src = objectUrl;
  });
}
