import { uploadBufferToCloudinary, destroyByPublicIds } from "../../lib/cloudinary";

export const imagesService = {
    async upload(file: Express.Multer.File) {
        return uploadBufferToCloudinary(file.buffer);
    },

    async remove(publicId: string) {
        await destroyByPublicIds([publicId]);
    },
};
