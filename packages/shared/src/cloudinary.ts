// Cloudinary URL builder.
// Transformations are applied at render time via URL params (no eager transforms).
// We never sign URLs here — signing is server-side only (in apps/api).

export type CloudinaryPreset =
    | "thumb"      // small admin / cart row thumbnail
    | "card"       // product card on listings
    | "detailMain" // main image in product gallery
    | "detailZoom"; // larger zoom in gallery

const PRESETS: Record<CloudinaryPreset, string> = {
    thumb: "w_120,h_120,c_fill,q_auto,f_auto",
    card: "w_400,h_400,c_fill,q_auto,f_auto",
    detailMain: "w_1200,h_1200,c_limit,q_auto,f_auto",
    detailZoom: "w_2000,h_2000,c_limit,q_auto,f_auto",
};

/**
 * Build a Cloudinary delivery URL for a given publicId + preset.
 * Requires NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME (web) or CLOUDINARY_CLOUD_NAME (server).
 *
 *   cloudinaryUrl("ecomm/products/abc123", "card")
 *   -> "https://res.cloudinary.com/<cloud>/image/upload/w_400,h_400,c_fill,q_auto,f_auto/ecomm/products/abc123"
 */
export function cloudinaryUrl(publicId: string, preset: CloudinaryPreset): string {
    const cloud =
        (typeof process !== "undefined" &&
            (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ??
                process.env.CLOUDINARY_CLOUD_NAME)) ||
        "";

    if (!cloud) {
        throw new Error(
            "cloudinaryUrl: missing NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME / CLOUDINARY_CLOUD_NAME env",
        );
    }

    const transform = PRESETS[preset];
    return `https://res.cloudinary.com/${cloud}/image/upload/${transform}/${publicId}`;
}
