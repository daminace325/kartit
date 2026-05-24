import { z } from "../lib/zod";

export const deleteImageSchema = z.object({
    publicId: z.string().min(1),
});
export type DeleteImageInput = z.infer<typeof deleteImageSchema>;
