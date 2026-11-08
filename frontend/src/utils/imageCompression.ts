const MAX_DIMENSION = 1920;
const WEBP_QUALITY = 0.82;

export const compressImageForUpload = async (file: File) => {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Image must be a JPG, PNG, or WEBP file.');
  if (typeof createImageBitmap !== 'function') return file;

  let image: ImageBitmap | null = null;
  try {
    image = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return file;
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    image?.close();
  }
};
