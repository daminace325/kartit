import { Router } from "express";
import {
    signupSchema,
    signinSchema,
    changePasswordSchema,
    updateProfileSchema,
    addressInputSchema,
} from "@repo/shared";
import { validate } from "../../middlewares/validate";
import { requireAuth } from "../../middlewares/requireAuth";
import {
    signup,
    signin,
    signout,
    me,
    changePassword,
    updateProfile,
    listAddresses,
    createAddress,
    updateAddress,
    deleteAddress,
} from "./auth.controller";

export const authRouter: Router = Router();

authRouter.post("/signup", validate(signupSchema), signup);
authRouter.post("/signin", validate(signinSchema), signin);
authRouter.post("/signout", signout);
authRouter.get("/me", requireAuth, me);
authRouter.patch(
    "/me",
    requireAuth,
    validate(updateProfileSchema),
    updateProfile,
);
authRouter.post(
    "/change-password",
    requireAuth,
    validate(changePasswordSchema),
    changePassword,
);

authRouter.get("/me/addresses", requireAuth, listAddresses);
authRouter.post(
    "/me/addresses",
    requireAuth,
    validate(addressInputSchema),
    createAddress,
);
authRouter.put(
    "/me/addresses/:id",
    requireAuth,
    validate(addressInputSchema),
    updateAddress,
);
authRouter.delete("/me/addresses/:id", requireAuth, deleteAddress);
