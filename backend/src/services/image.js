const MAX_IMAGE_BYTES = 512 * 1024;
const MAX_IMAGE_URL_LENGTH = 2048;

export function esReferenciaImagenValida(value) {
  if (value === null || value === undefined || value === "") return true;
  if (typeof value !== "string") return false;

  if (value.length <= MAX_IMAGE_URL_LENGTH && /^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      return Boolean(url.hostname);
    } catch {
      return false;
    }
  }

  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if (!match) return false;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > MAX_IMAGE_BYTES) return false;

  switch (match[1].toLowerCase()) {
    case "png":
      return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case "jpeg":
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "webp":
      return bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.toString("ascii", 8, 12) === "WEBP";
    default:
      return false;
  }
}
