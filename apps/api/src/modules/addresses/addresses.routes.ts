import { Router } from "express";
import { addressInputSchema, idParamSchema } from "@repo/shared";
import { validate } from "../../middlewares/validate";
import { requireAuth } from "../../middlewares/requireAuth";
import {
    listAddresses,
    createAddress,
    updateAddress,
    deleteAddress,
} from "./addresses.controller";

export const addressesRouter: Router = Router();

// All address routes require an authenticated user.
addressesRouter.use(requireAuth);

addressesRouter.get("/", listAddresses);
addressesRouter.post("/", validate(addressInputSchema), createAddress);
addressesRouter.put("/:id", validate(idParamSchema, "params"), validate(addressInputSchema), updateAddress);
addressesRouter.delete("/:id", validate(idParamSchema, "params"), deleteAddress);
