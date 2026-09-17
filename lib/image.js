// Resizes/re-encodes an image file in the browser before it's uploaded, so
// a full-resolution screenshot doesn't blow up the request or storage size.
export async function compressImageFile(file, { maxWidth = 1400, maxBytes = 700_000 } = {}) {
  const rawDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That doesn't look like an image."));
    image.src = rawDataUrl;
  });

  const scale = Math.min(1, maxWidth / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let quality = 0.85;
  let output = canvas.toDataURL("image/jpeg", quality);
  while (output.length > maxBytes * 1.37 && quality > 0.35) {
    quality -= 0.15;
    output = canvas.toDataURL("image/jpeg", quality);
  }

  return output;
}
