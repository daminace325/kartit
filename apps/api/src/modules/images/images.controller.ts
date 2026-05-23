import type { RequestHandler } from "express";
import { destroyByPublicIds, uploadBufferToCloudinary } from "../../lib/cloudinary";
import { AppError } from "../../lib/errors";
import { asyncHandler } from "../../lib/asyncHandler";
import type { DeleteImageInput } from "@repo/shared";

export const uploadImage = asyncHandler(async (req, res) => {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
        throw AppError.badRequest("VALIDATION_FAILED", "No file provided (field name: 'file')");
    }
    const result = await uploadBufferToCloudinary(file.buffer);
    res.status(201).json(result);
});

export const deleteImage = asyncHandler(async (req, res) => {
    const { publicId } = req.body as DeleteImageInput;
    await destroyByPublicIds([publicId]);
    res.json({ ok: true });
});
