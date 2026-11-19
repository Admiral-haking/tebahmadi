export const DGK_USER_PROMPT_TEMPLATE = `Convert the Digikala product data below to my MongoDB product schema.

DIGIKALA PRODUCT (single object):
{{productJson}}

DIGIKALA VARIANTS (array):
{{variantsJson}}

MY PRODUCT TYPE SCHEMA (attribute definitions):
{{productTypeAttributesJson}}

AVAILABLE CATEGORIES (array of {id, name, path}):
{{categoriesJson}}

--- TASK PRIORITIES (in order) ---
1) Slug generation - MUST be valid format (ONLY a-z, 0-9, hyphens)
2) High-quality commercial Persian product naming
3) Strong, factual Persian description (4-6 sentences, persuasive)
4) SEO title (50-65 chars) + SEO description (120-155 chars) with real keywords
5) Accurate category selection — ALL relevant category IDs (leaf + ancestors +
   related), NOT name/path, NOT limited to one
6) Complete attribute mapping — fill EVERY ProductType attribute precisely

!!! STRICT SLUG RULES (WILL FAIL IF WRONG) !!!
The slug field is VALIDATED server-side with regex: ^[a-z0-9]+(?:-[a-z0-9]+)*$
This means:
- ONLY lowercase english letters (a-z)
- ONLY digits (0-9)
- ONLY hyphens (-) as separators
- NO Persian/Arabic letters (فارسی ممنوع!)
- NO spaces
- NO underscores
- NO special characters
- MUST start and end with a letter or digit (not hyphen)

SLUG GENERATION PROCESS:
Step 1: Get the clean Persian title
Step 2: Convert EVERY Persian character to Latin transliteration
  Examples: "گوشی" -> "gushi", "شارژر" -> "sharzher"
Step 3: Replace ALL non [a-z0-9] characters with hyphens
Step 4: Collapse multiple hyphens into one
Step 5: Remove leading/trailing hyphens
Step 6: Verify the result matches ^[a-z0-9]+(?:-[a-z0-9]+)*$

Example slugs:
- "apple-iphone-15-pro-max-256gb" (OK)
- "samsung-galaxy-s24-ultra" (OK)
- "xiaomi-redmi-note-13-pro-plus" (OK)
- "gushi-motorola-edge-50-pro" (OK - from "گوشی موتورولا اج ۵۰ پرو")
- "گوشی-موتورولا" (WRONG - contains Persian chars)

!!! CATEGORY RULES !!!
- categories is an ARRAY of category ID strings — include ALL relevant ones, not
  just one. Use ONLY ids that exist in AVAILABLE CATEGORIES; never invent ids and
  never put name/path text.
- Pick the most specific (leaf) matching category by 'path', AND also include its
  parent/ancestor categories that exist in the list, AND any other available
  category that clearly fits the product (parent + sub-categories).
- Match the leaf using main_category_title + category_path from the product data.
- Relevance over quantity. Return format: ["leaf_id","parent_id", ...] (usually 2-4).

!!! DESCRIPTION QUALITY !!!
Write 4-6 flowing Persian sentences:
1. What is this product? Who is it for?
2. Key features and build quality (from data)
3. Practical benefits for the user
4. What makes it better than alternatives?
5. Usage scenarios
6. Trust-building closing

Target 350-950 Persian characters total. No emojis, no HTML.
ZERO errors: correct grammar/spelling, no half sentences, no English/marketplace
leftovers, no repetition or contradictions. Use only real specs from the data.

!!! SEO (professional) !!!
seoTitle: 50-65 chars, include primary keyword + brand + model, click-worthy but factual
seoDescription: 120-155 chars, include keyword + benefit + call-to-action, no keyword stuffing

!!! ATTRIBUTES !!!
- Fill EVERY ProductType attribute (product-level and variant-level). Infer from
  title + specs + category; use "" only when truly unknown, never null.

!!! VARIANTS !!!
- Each variant MUST have: sku, priceAmount, inventoryQuantity, attributeValues with weightGrams
- mediaIds: include variant image + ALL available gallery images (not just a few)
- barcode: from supplier_code (omit if empty)
- offer: enabled when promotion_price < price_sale

Now produce the final converted product JSON.`;