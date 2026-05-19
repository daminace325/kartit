import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";
import { logger } from "./logger";

cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
});

/**
 * Stream a buffer to Cloudinary and resolve with the secure URL + public ID.
 * Throws on Cloudinary error so the caller can propagate as a 500.
 */
export function uploadBufferToCloudinary(
    buffer: Buffer,
    folder: string = env.CLOUDINARY_FOLDER,
): Promise<{ url: string; publicId: string }> {
    return new Promise((resolve, reject) => {
        cloudinary.uploader
            .upload_stream(
                { folder, resource_type: "image" },
                (err, result) => {
                    if (err || !result) return reject(err ?? new Error("Cloudinary upload failed"));
                    resolve({ url: result.secure_url, publicId: result.public_id });
                },
            )
            .end(buffer);
    });
}

/**
 * Best-effort deletion of one or more Cloudinary assets by publicId.
 * Failures are logged but never thrown — orphan cleanup must not break
 * the primary request flow.
 */
export async function destroyByPublicIds(publicIds: string[]): Promise<void> {
    const ids = publicIds.filter((id) => typeof id === "string" && id.length > 0);
    if (ids.length === 0) return;
    await Promise.all(
        ids.map((id) =>
            cloudinary.uploader
                .destroy(id)
                .catch((err) => logger.error(`Cloudinary destroy failed for ${id}:`, err)),
        ),
    );
}

