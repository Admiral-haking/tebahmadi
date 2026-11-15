import assert from "node:assert/strict";
import test from "node:test";
import { cartLineKey, resolveCartLines } from "../lib/storefront-cart";

test("cart keeps two variants of one product as separate sellable lines", () => {
  const products = [{
    id: "product-1",
    name: "محصول چندمدلی",
    price: 100,
    variants: [
      { id: "variant-small", title: "کوچک", price_toman: 100, available_quantity: 3 },
      { id: "variant-large", title: "بزرگ", price_toman: 140, available_quantity: 2 },
    ],
  }];
  const cart = {
    [cartLineKey("product-1", "variant-small")]: 1,
    [cartLineKey("product-1", "variant-large")]: 2,
  };

  const lines = resolveCartLines(cart, products);
  assert.equal(lines.length, 2);
  assert.deepEqual(lines.map((line) => line.variant.id), ["variant-small", "variant-large"]);
  assert.deepEqual(lines.map((line) => line.quantity), [1, 2]);
});

test("legacy product-only cart keys still resolve to the default variant", () => {
  const lines = resolveCartLines({ "product-1": 1 }, [{ id: "product-1", name: "قدیمی", price: 100, variants: [{ id: "variant-default", price_toman: 100, available_quantity: 4 }] }]);
  assert.equal(lines[0]?.variant.id, "variant-default");
  assert.equal(lines[0]?.product.id, "product-1");
});
