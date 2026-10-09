const MAX_IMAGE_BYTES = 512 * 1024;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function leerImagenComoDataUrl(file) {
  if (!IMAGE_TYPES.has(file.type)) {
    return Promise.reject(new Error("Selecciona una imagen PNG, JPEG o WebP."));
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return Promise.reject(new Error("La imagen no debe superar los 512 KB."));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("No se pudo leer el archivo de imagen."));
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo de imagen."));
    reader.readAsDataURL(file);
  });
}
