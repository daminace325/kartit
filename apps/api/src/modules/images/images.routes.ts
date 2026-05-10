import { Router } from "express";
import { requireAdmin, requireAuth } from "../../middlewares/requireAuth";
import { uploadImage as uploadImageMw } from "../../middlewares/upload";
import { deleteImage, uploadImage } from "./images.controller";

export const imagesRouter: Router = Router();

// All image routes require an authenticated admin.
imagesRouter.use(requireAuth, requireAdmin);

imagesRouter.post("/upload", uploadImageMw.single("file"), uploadImage);
imagesRouter.delete("/", deleteImage);
