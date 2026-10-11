const MAX_LISTING_PHOTOS = 8;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/**
 * @param {unknown} images
 * @returns {Array<{ id?: number, url: string, isPrimary?: boolean, altText?: string | null, caption?: string | null, order?: number, listingId?: number }>}
 */
function storedPhotos(images) {
  if (!Array.isArray(images)) return [];
  const rows = images.filter((image) => image && typeof image.url === "string" && image.url.length > 0);
  return rows.slice().sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    const aOrder = typeof a.order === "number" ? a.order : 0;
    const bOrder = typeof b.order === "number" ? b.order : 0;
    return aOrder - bOrder;
  });
}

/**
 * @param {{ altText?: string | null, caption?: string | null } | null | undefined} photo
 * @param {string} title
 */
function photoAlt(photo, title) {
  if (photo && typeof photo.altText === "string" && photo.altText.trim()) return photo.altText.trim();
  if (photo && typeof photo.caption === "string" && photo.caption.trim()) return photo.caption.trim();
  return title || "Listing photo";
}

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_EXTENSIONS = /\.(jpe?g|png|webp)$/i;

// Owner-facing photo messages. Pending Web Lead review.
const PHOTO_MESSAGES = {
  wrongType: "That file type is not supported. Use a JPEG, PNG, or WebP photo.",
  tooLarge: "That photo is larger than 8 MB. Choose a smaller one.",
  empty: "That file is empty. Choose a photo.",
  full: "This home already has 8 photos. Remove one to add another.",
  storageOff: "Photo uploads are not available right now. Nothing was saved. Try again later.",
  network: "We could not reach Lodgist. Check your connection and try again. Nothing was saved.",
  failed: "We could not save that photo. Nothing was saved.",
  added: "Photo added.",
  removed: "Photo removed.",
};

/** null when the file can be uploaded, otherwise the message to show. */
function validatePhotoFile(file, currentCount) {
  if (currentCount >= MAX_LISTING_PHOTOS) return PHOTO_MESSAGES.full;
  if (!file || typeof file.size !== "number" || file.size <= 0) return PHOTO_MESSAGES.empty;
  const typeOk = file.type ? PHOTO_TYPES.includes(file.type) : PHOTO_EXTENSIONS.test(String(file.name || ""));
  if (!typeOk) return PHOTO_MESSAGES.wrongType;
  if (file.size > MAX_PHOTO_BYTES) return PHOTO_MESSAGES.tooLarge;
  return null;
}

/** Maps an upload/remove failure to a message; raw server text is never shown. */
function photoErrorMessage(err) {
  const status = err && typeof err.status === "number" ? err.status : null;
  if (status === null && err && err.name === "TypeError") return PHOTO_MESSAGES.network;
  if (err && typeof err.message === "string" && /storage not configured/i.test(err.message)) return PHOTO_MESSAGES.storageOff;
  if (status === 408 && err.message) return err.message;
  if (status === 413) return PHOTO_MESSAGES.tooLarge;
  if (status === 415) return PHOTO_MESSAGES.wrongType;
  return PHOTO_MESSAGES.failed;
}

module.exports = {
  PHOTO_MESSAGES,
  validatePhotoFile,
  photoErrorMessage,
  MAX_LISTING_PHOTOS,
  MAX_PHOTO_BYTES,
  storedPhotos,
  photoAlt,
};
