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

module.exports = {
  MAX_LISTING_PHOTOS,
  MAX_PHOTO_BYTES,
  storedPhotos,
  photoAlt,
};
