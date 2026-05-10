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
        where: { id: parentId },
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
            where: { parentId: selfId },
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
        const where =
            query.parentId === undefined
                ? {}
                : query.parentId === "" || query.parentId === "null"
                    ? { parentId: null }
                    : { parentId: query.parentId };

        return prisma.category.findMany({
            where,
            orderBy: { name: "asc" },
            select: SELECT,
        });
    },

    async getById(id: string) {
        const category = await prisma.category.findUnique({
            where: { id },
            select: SELECT,
        });
        if (!category) throw AppError.notFound("NOT_FOUND", "Category not found");
        return category;
    },

    async getBySlug(slug: string) {
        const category = await prisma.category.findUnique({
            where: { slug },
            select: SELECT,
        });
        if (!category) throw AppError.notFound("NOT_FOUND", "Category not found");
        return category;
    },

    async create(input: CategoryCreateInput) {
        const existing = await prisma.category.findUnique({
            where: { slug: input.slug },
            select: { id: true },
        });
        if (existing) {
            throw AppError.conflict(
                "SLUG_TAKEN",
                "A category with this slug already exists",
            );
        }

        const parentId = normalizeParentId(input);
        if (parentId) await assertValidParent(parentId);

        return prisma.category.create({
            data: {
                slug: input.slug,
                name: input.name,
                parentId: parentId ?? null,
            },
            select: SELECT,
        });
    },

    async update(id: string, input: CategoryUpdateInput) {
        const current = await prisma.category.findUnique({
            where: { id },
            select: { id: true, parentId: true },
        });
        if (!current) throw AppError.notFound("NOT_FOUND", "Category not found");

        if (input.slug) {
            const clash = await prisma.category.findFirst({
                where: { slug: input.slug, NOT: { id } },
                select: { id: true },
            });
            if (clash) {
                throw AppError.conflict(
                    "SLUG_TAKEN",
                    "A category with this slug already exists",
                );
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
            },
            select: SELECT,
        });
    },

    async remove(id: string) {
        const [productCount, childCount] = await Promise.all([
            prisma.product.count({ where: { categoryId: id } }),
            prisma.category.count({ where: { parentId: id } }),
        ]);
        if (productCount > 0 || childCount > 0) {
            const parts: string[] = [];
            if (childCount > 0) {
                parts.push(
                    `${childCount} subcategor${childCount === 1 ? "y" : "ies"}`,
                );
            }
            if (productCount > 0) {
                parts.push(
                    `${productCount} product${productCount === 1 ? "" : "s"}`,
                );
            }
            throw AppError.conflict(
                childCount > 0 ? "CATEGORY_HAS_CHILDREN" : "CATEGORY_HAS_PRODUCTS",
                `Cannot delete: category still has ${parts.join(
                    " and ",
                )}. Reassign or delete them first.`,
            );
        }
        try {
            await prisma.category.delete({ where: { id } });
        } catch {
            throw AppError.notFound("NOT_FOUND", "Category not found");
        }
    },
};
