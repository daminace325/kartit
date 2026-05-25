import { prisma } from "@repo/db";
import type { Prisma } from "@repo/db";
import type {
    ProductCreateInput,
    ProductDTO,
    ProductImageDTO,
    ProductListQuery,
    ProductUpdateInput,
} from "@repo/shared";
import { destroyByPublicIds } from "../../lib/cloudinary";
import { AppError } from "../../lib/errors";

type ProductWithImages = Prisma.ProductGetPayload<{
    include: { images: true };
}>;

function toImageDTO(img: ProductWithImages["images"][number]): ProductImageDTO {
    return {
        id: img.id,
        url: img.url,
        publicId: img.publicId,
        alt: img.alt,
        position: img.position,
    };
}

function toProductDTO(p: ProductWithImages): ProductDTO {
    return {
        id: p.id,
        slug: p.slug,
        sku: p.sku,
        name: p.name,
        description: p.description,
        priceMinor: p.priceMinor.toString(),
        currency: p.currency,
        stock: p.stock,
        isActive: p.isActive,
        categoryId: p.categoryId,
        images: [...p.images]
            .sort((a, b) => a.position - b.position)
            .map(toImageDTO),
    };
}

export const productsService = {
    async list(query: ProductListQuery) {
        const { q, categoryId, categoryIds, cursor, limit } = query;

        const idList = categoryIds
            ? categoryIds
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
            : [];

        const categoryFilter: Prisma.ProductWhereInput =
            idList.length > 0
                ? { categoryId: { in: idList } }
                : categoryId
                    ? { categoryId }
                    : {};

        const where: Prisma.ProductWhereInput = {
            isActive: true,
            deletedAt: null,
            ...categoryFilter,
            ...(q
                ? {
                      OR: [
                          { name: { contains: q, mode: "insensitive" } },
                          { description: { contains: q, mode: "insensitive" } },
                      ],
                  }
                : {}),
        };

        // Cursor pagination on (createdAt desc, id desc) — fetch limit+1 to detect next page.
        const rows = await prisma.product.findMany({
            where,
            include: { images: true },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });

        const hasNext = rows.length > limit;
        const items = (hasNext ? rows.slice(0, limit) : rows).map(toProductDTO);
        const nextCursor = hasNext ? items[items.length - 1].id : null;

        return { items, nextCursor };
    },

    async getById(id: string) {
        const product = await prisma.product.findUnique({
            where: { id, isActive: true, deletedAt: null },
            include: { images: true },
        });
        if (!product) throw AppError.notFound("NOT_FOUND", "Product not found");
        return toProductDTO(product);
    },

    async getBySlug(slug: string) {
        const product = await prisma.product.findUnique({
            where: { slug, deletedAt: null },
            include: { images: true },
        });
        if (!product || !product.isActive) {
            throw AppError.notFound("NOT_FOUND", "Product not found");
        }
        return toProductDTO(product);
    },

    async create(input: ProductCreateInput) {
        // slug uniqueness
        const slugClash = await prisma.product.findUnique({
            where: { slug: input.slug, deletedAt: null },
            select: { id: true },
        });
        if (slugClash) {
            throw AppError.conflict(
                "SLUG_TAKEN",
                "A product with this slug already exists",
            );
        }

        // category must exist
        const categoryExists = await prisma.category.findUnique({
            where: { id: input.categoryId, deletedAt: null },
            select: { id: true },
        });
        if (!categoryExists) {
            throw AppError.badRequest("INVALID_CATEGORY", "Category not found");
        }

        const { images, ...rest } = input;

        const created = await prisma.product.create({
            data: {
                ...rest,
                priceMinor: BigInt(rest.priceMinor),
                images: {
                    create: images.map((img, idx) => ({
                        url: img.url,
                        publicId: img.publicId,
                        alt: img.alt ?? null,
                        position: idx,
                    })),
                },
            },
            include: { images: true },
        });

        return toProductDTO(created);
    },

    async update(id: string, input: ProductUpdateInput) {
        const existing = await prisma.product.findUnique({
            where: { id, deletedAt: null },
            include: { images: true },
        });
        if (!existing) throw AppError.notFound("NOT_FOUND", "Product not found");

        if (input.slug && input.slug !== existing.slug) {
            const clash = await prisma.product.findFirst({
                where: { slug: input.slug, NOT: { id }, deletedAt: null },
                select: { id: true },
            });
            if (clash) {
                throw AppError.conflict(
                    "SLUG_TAKEN",
                    "A product with this slug already exists",
                );
            }
        }

        if (input.categoryId && input.categoryId !== existing.categoryId) {
            const categoryExists = await prisma.category.findUnique({
                where: { id: input.categoryId, deletedAt: null },
                select: { id: true },
            });
            if (!categoryExists) {
                throw AppError.badRequest("INVALID_CATEGORY", "Category not found");
            }
        }

        const { images, ...rest } = input;

        // Compute removed Cloudinary publicIds (best-effort cleanup after the tx).
        let removedPublicIds: string[] = [];
        if (images) {
            const newSet = new Set(images.map((i) => i.publicId));
            removedPublicIds = existing.images
                .filter((img) => !newSet.has(img.publicId))
                .map((img) => img.publicId);
        }

        const updated = await prisma.$transaction(async (tx) => {
            // Replace images atomically: delete all, recreate in submitted order.
            if (images) {
                await tx.productImage.deleteMany({ where: { productId: id } });
                if (images.length > 0) {
                    await tx.productImage.createMany({
                        data: images.map((img, idx) => ({
                            productId: id,
                            url: img.url,
                            publicId: img.publicId,
                            alt: img.alt ?? null,
                            position: idx,
                        })),
                    });
                }
            }

            return tx.product.update({
                where: { id },
                data: {
                    ...rest,
                    ...(rest.priceMinor !== undefined
                        ? { priceMinor: BigInt(rest.priceMinor) }
                        : {}),
                },
                include: { images: true },
            });
        });

        if (removedPublicIds.length > 0) {
            destroyByPublicIds(removedPublicIds).catch(() => {});
        }

        return toProductDTO(updated);
    },

    async remove(id: string) {
        const product = await prisma.product.findUnique({
            where: { id, deletedAt: null },
            select: { id: true },
        });
        if (!product) throw AppError.notFound("NOT_FOUND", "Product not found");

        await prisma.product.update({
            where: { id },
            data: { deletedAt: new Date(), isActive: false },
        });
    },
};
