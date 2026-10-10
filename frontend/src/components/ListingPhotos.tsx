"use client";

import { useState, type ChangeEvent } from "react";
import { ApiError, listingsApi } from "@/lib/api";
import { detail } from "@/lib/copy";
import { MAX_LISTING_PHOTOS, MAX_PHOTO_BYTES, photoAlt, storedPhotos } from "@/lib/listingPhotos";
import type { ListingImage } from "@/lib/types";

interface ListingPhotosProps {
  listingId: number;
  title: string;
  images: ListingImage[] | undefined;
  canManage: boolean;
  onImages: (images: ListingImage[]) => void;
}

export default function ListingPhotos({ listingId, title, images, canManage, onImages }: ListingPhotosProps) {
  const photos = storedPhotos(images);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Photo is larger than 8 MB.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await listingsApi.uploadPhoto(listingId, file);
      const photo = res.data;
      if (!photo) {
        setError(detail.photoFailed);
        return;
      }
      onImages([
        ...(images ?? []),
        {
          id: photo.id,
          url: photo.url,
          caption: photo.altText,
          altText: photo.altText,
          isPrimary: photo.isPrimary,
          order: photo.order,
          listingId: photo.listingId,
        },
      ]);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : detail.photoFailed;
      setError(message === "storage not configured" ? `${message}. ${detail.photoNotSaved}` : message);
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(imageId: number) {
    setBusy(true);
    setError(null);
    try {
      await listingsApi.deletePhoto(listingId, imageId);
      onImages((images ?? []).filter((image) => image.id !== imageId));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : detail.photoFailed;
      setError(message === "storage not configured" ? `${message}. ${detail.photoNotSaved}` : message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 mb-6" aria-labelledby="listing-photos-heading">
      <h2 id="listing-photos-heading" className="font-poppins font-semibold text-white mb-3">{detail.photos}</h2>
      {photos.length === 0 ? (
        <div className="h-56 rounded-xl flex items-center justify-center" style={{ background: "var(--color-surface-2)" }}>
          <span className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>{detail.noPhoto}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {photos.map((photo, index) => {
            const imageId = typeof photo.id === "number" ? photo.id : null;
            return (
            <figure key={imageId ?? photo.url} className={index === 0 ? "sm:col-span-2" : undefined}>
              <img
                src={photo.url}
                alt={photoAlt(photo, title)}
                className={`w-full object-cover rounded-xl ${index === 0 ? "h-56" : "h-32"}`}
              />
              {canManage && imageId != null && (
                <button type="button" className="btn btn-secondary mt-2" onClick={() => onRemove(imageId)} disabled={busy}>
                  {detail.removePhoto}
                </button>
              )}
            </figure>
            );
          })}
        </div>
      )}
      {canManage && (
        <div className="mt-4">
          <label className="text-sm block mb-2" htmlFor="listing-photo" style={{ color: "rgba(255,255,255,0.7)" }}>
            {detail.addPhoto}
          </label>
          <input
            id="listing-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            onChange={onFile}
            disabled={busy || photos.length >= MAX_LISTING_PHOTOS}
          />
          <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.45)" }}>{detail.photoHint}</p>
        </div>
      )}
      {error && <p className="text-sm mt-3" role="alert" style={{ color: "var(--color-orange)" }}>{error}</p>}
      {busy && <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>{detail.addingPhoto}</p>}
    </section>
  );
}
