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

addressesRouter.get("/", requireAuth, listAddresses);
addressesRouter.post("/", requireAuth, validate(addressInputSchema), createAddress);
addressesRouter.put("/:id", requireAuth, validate(idParamSchema, "params"), validate(addressInputSchema), updateAddress);
addressesRouter.delete("/:id", requireAuth, validate(idParamSchema, "params"), deleteAddress);
