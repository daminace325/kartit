import type { RequestHandler } from "express";
import { destroyByPublicIds, uploadBufferToCloudinary } from "../../lib/cloudinary";
import { AppError } from "../../lib/errors";

export const uploadImage: RequestHandler = async (req, res, next) => {
    try {
        const file = (req as any).file as Express.Multer.File | undefined;
        if (!file) {
            throw AppError.badRequest("VALIDATION_FAILED", "No file provided (field name: 'file')");
        }
        const result = await uploadBufferToCloudinary(file.buffer);
        res.status(201).json(result);
    } catch (err) {
        next(err);
    }
};

export const deleteImage: RequestHandler = async (req, res, next) => {
    try {
        const { publicId } = req.body as { publicId?: unknown };
        if (typeof publicId !== "string" || publicId.length === 0) {
            throw AppError.badRequest("VALIDATION_FAILED", "publicId is required");
        }
        await destroyByPublicIds([publicId]);
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
};
