import type { Product, PublicProduct } from "./types";

/** Strips the internal fields (SKU, supplier, variant SKUs) from a product
 *  before it reaches a public page or a client component. */
export function toPublicProduct(product: Product): PublicProduct {
  const { variants, ...rest } = product;
  const publicProduct: Record<string, unknown> = { ...rest };
  delete publicProduct.sku;
  delete publicProduct.supplier;
  return {
    ...(publicProduct as Omit<PublicProduct, "variants">),
    ...(variants
      ? { variants: variants.map(({ id, attributes, stock }) => ({ id, attributes, stock })) }
      : {}),
  };
}
