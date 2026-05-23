import { Router } from "express";
import {
    signupSchema,
    signinSchema,
    changePasswordSchema,
    updateProfileSchema,
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
    signOutAll,
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
authRouter.post("/sign-out-all", requireAuth, signOutAll);
