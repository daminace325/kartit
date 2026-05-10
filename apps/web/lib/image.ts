import { cloudinaryUrl, type CloudinaryPreset } from "@repo/shared";

/**
 * Build a Cloudinary URL from a `ProductImageDTO`-shaped record. Falls back
 * to the raw `url` if the cloud-name env isn't configured (dev convenience).
 */
export function productImageUrl(
    image: { url: string; publicId: string } | null | undefined,
    preset: CloudinaryPreset,
): string | null {
    if (!image) return null;
    try {
        return cloudinaryUrl(image.publicId, preset);
    } catch {
        return image.url;
    }
}
