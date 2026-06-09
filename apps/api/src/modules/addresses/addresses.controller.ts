import { addressesService } from "./addresses.service";
import { asyncHandler } from "../../lib/asyncHandler";
import { userIdOrThrow } from "../../lib/request";

export const listAddresses = asyncHandler(async (req, res) => {
    const addresses = await addressesService.list(userIdOrThrow(req));
    res.json({ addresses });
});

export const createAddress = asyncHandler(async (req, res) => {
    const address = await addressesService.create(userIdOrThrow(req), req.body);
    res.status(201).json({ address });
});

export const updateAddress = asyncHandler(async (req, res) => {
    const address = await addressesService.update(
        userIdOrThrow(req),
        String(req.params.id),
        req.body,
    );
    res.json({ address });
});

export const deleteAddress = asyncHandler(async (req, res) => {
    await addressesService.delete(userIdOrThrow(req), String(req.params.id));
    res.status(204).end();
});
