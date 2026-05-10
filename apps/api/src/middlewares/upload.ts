import multer from "multer";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export const uploadImage = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_SIZE },
    fileFilter: (req, file, cb) => {
        if (!ALLOWED_TYPES.has(file.mimetype)) {
            return cb(new Error(`Invalid file type. Allowed: ${[...ALLOWED_TYPES].join(", ")}`));
        }
        cb(null, true);
    },
});
