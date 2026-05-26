import { prisma } from "@repo/db";
import type {
    CategoryCreateInput,
    CategoryListQuery,
    CategoryUpdateInput,
} from "@repo/shared";
import { AppError } from "../../lib/errors";

const SELECT = {
    id: true,
    slug: true,
    name: true,
    parentId: true,
    isActive: true,
} as const;

function normalizeParentId(input: { parentId?: string | null }): string | null | undefined {
    // Treat empty string and "null" as explicit null (top-level).
    if (input.parentId === undefined) return undefined;
    if (input.parentId === null || input.parentId === "" || input.parentId === "null") {
        return null;
    }
    return input.parentId;
}

async function assertValidParent(parentId: string, selfId?: string) {
    if (selfId && parentId === selfId) {
        throw AppError.badRequest(
            "INVALID_PARENT",
            "Category cannot be its own parent",
        );
    }
    const parent = await prisma.category.findUnique({
        where: { id: parentId, deletedAt: null, isActive: true },
        select: { id: true, parentId: true },
    });
    if (!parent) {
        throw AppError.notFound("PARENT_NOT_FOUND", "Parent category not found");
    }
    if (parent.parentId) {
        throw AppError.badRequest(
            "MAX_DEPTH",
            "Only 2-level category nesting is allowed",
        );
    }
    if (selfId) {
        // If selfId already has children, it cannot become a child
        // (would push the existing children to depth 3).
        const childCount = await prisma.category.count({
            where: { parentId: selfId, deletedAt: null },
        });
        if (childCount > 0) {
            throw AppError.badRequest(
                "HAS_SUBCATEGORIES",
                "Cannot nest: this category already has subcategories",
            );
        }
    }
}

export const categoriesService = {
    async list(query: CategoryListQuery = {}) {
        const isActive = query.includeInactive ? undefined : true;
        const where =
            query.parentId === undefined
                ? { deletedAt: null, isActive }
                : query.parentId === "" || query.parentId === "null"
                    ? { parentId: null, deletedAt: null, isActive }
                    : { parentId: query.parentId, deletedAt: null, isActive };

        return prisma.category.findMany({
            where,
            orderBy: { name: "asc" },
            select: SELECT,
        });
    },

    async getById(id: string, opts?: { includeInactive?: boolean }) {
        const category = await prisma.category.findUnique({
            where: { id, deletedAt: null, isActive: opts?.includeInactive ? undefined : true },
            select: SELECT,
        });
        if (!category) throw AppError.notFound("NOT_FOUND", "Category not found");
        return category;
    },

    async getBySlug(slug: string) {
        const category = await prisma.category.findUnique({
            where: { slug, deletedAt: null, isActive: true },
            select: SELECT,
        });
        if (!category) throw AppError.notFound("NOT_FOUND", "Category not found");
        return category;
    },

    async create(input: CategoryCreateInput) {
        const existing = await prisma.category.findUnique({
            where: { slug: input.slug },
            select: { id: true, deletedAt: true },
        });
        if (existing) {
            if (existing.deletedAt) {
                await prisma.category.update({
                    where: { id: existing.id },
                    data: { slug: `deleted-${existing.id}-${input.slug}` },
                });
            } else {
                throw AppError.conflict(
                    "SLUG_TAKEN",
                    "A category with this slug already exists",
                );
            }
        }

        const parentId = normalizeParentId(input);
        if (parentId) await assertValidParent(parentId);

        return prisma.category.create({
            data: {
                slug: input.slug,
                name: input.name,
                parentId: parentId ?? null,
                isActive: input.isActive,
            },
            select: SELECT,
        });
    },

    async update(id: string, input: CategoryUpdateInput) {
        const current = await prisma.category.findUnique({
            where: { id, deletedAt: null },
            select: { id: true, parentId: true },
        });
        if (!current) throw AppError.notFound("NOT_FOUND", "Category not found");

        if (input.slug) {
            const clash = await prisma.category.findFirst({
                where: { slug: input.slug, NOT: { id } },
                select: { id: true, deletedAt: true },
            });
            if (clash) {
                if (clash.deletedAt) {
                    await prisma.category.update({
                        where: { id: clash.id },
                        data: { slug: `deleted-${clash.id}-${input.slug}` },
                    });
                } else {
                    throw AppError.conflict(
                        "SLUG_TAKEN",
                        "A category with this slug already exists",
                    );
                }
            }
        }

        const parentId = normalizeParentId(input);
        if (parentId) await assertValidParent(parentId, id);

        return prisma.category.update({
            where: { id },
            data: {
                ...(input.slug !== undefined ? { slug: input.slug } : {}),
                ...(input.name !== undefined ? { name: input.name } : {}),
                ...(parentId !== undefined ? { parentId } : {}),
                ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
            },
            select: SELECT,
        });
    },

    async remove(id: string) {
        await prisma.$transaction(async (tx) => {
            // Collect subcategory ids (only 2-level nesting is enforced, so a
            // single-level fetch is sufficient).
            const children = await tx.category.findMany({
                where: { parentId: id, deletedAt: null },
                select: { id: true },
            });
            const categoryIds = [id, ...children.map((c) => c.id)];

            // Soft-delete products belonging to this category or its children.
            await tx.product.updateMany({
                where: { categoryId: { in: categoryIds }, deletedAt: null },
                data: { deletedAt: new Date(), isActive: false },
            });

            // Soft-delete child categories.
            if (children.length > 0) {
                await tx.category.updateMany({
                    where: { id: { in: children.map((c) => c.id) } },
                    data: { deletedAt: new Date(), isActive: false },
                });
            }

            // Soft-delete the category itself.
            await tx.category.update({
                where: { id },
                data: { deletedAt: new Date(), isActive: false },
            });
        });
    },
};
