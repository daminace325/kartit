import type { RequestHandler } from "express";
import { destroyByPublicIds, uploadBufferToCloudinary } from "../../lib/cloudinary";
import { AppError } from "../../lib/errors";
import type { DeleteImageInput } from "@repo/shared";

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
        const { publicId } = req.body as DeleteImageInput;
        await destroyByPublicIds([publicId]);
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
};
