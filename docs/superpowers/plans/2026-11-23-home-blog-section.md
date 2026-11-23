# Home Blog Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** نمایش سه مطلب منتشرشدهٔ اخیر بلاگ در سکشنی فشرده و واکنش‌گرا، درست بالای فوتر صفحهٔ اصلی.

**Architecture:** یک لودر سروری مستقل برای صفحهٔ اصلی از دادهٔ منتشرشدهٔ بلاگ استفاده می‌کند و یک کامپوننت presentational کارت‌های سه‌تایی را رندر می‌کند. سکشن در نبود مطلب `null` برمی‌گرداند و صفحهٔ کامل بلاگ بدون تغییر می‌ماند.

**Tech Stack:** Next.js Server Components، React، MUI، Mongoose، Vitest، TypeScript.

**Spec:** `docs/superpowers/specs/2026-11-23-home-blog-section-design.md`

## Global Constraints

- فقط مطالب با وضعیت `published` نمایش داده شوند.
- حداکثر سه مطلب آخر نمایش داده شود.
- متن و تاریخ در خروجی فارسی باشند.
- در نبود مطلب، سکشن به‌طور کامل مخفی شود.
- از dependency جدید استفاده نشود.

## Review Focus

- نبود مطلب منتشرشده: سکشن نباید فضای خالی یا دادهٔ ساختگی بسازد؛ تست در Task 1.
- تصویر شاخص ناموجود: کارت باید placeholder برنددار داشته باشد؛ تست در Task 1.
- تاریخ نامعتبر یا خالی: کارت باید بدون تاریخ خراب رندر شود؛ تست در Task 1.
- عنوان یا slug خالی: لودر باید ورودی ناقص را کنار بگذارد؛ تست در Task 1.
- کمتر از سه مطلب: همهٔ مطالب موجود، بدون کارت خالی، نمایش داده شوند؛ تست در Task 1.

### Task 1: Home blog data and section

**Files:**
- Create: `src/views/home/components/blog.tsx`
- Test: `src/views/home/components/blog.test.ts`
- Modify: `src/views/home/index.tsx`

**Interfaces:**
- Consumes: `BlogPostListItem` و `loadBlogIndex` از `src/views/blog/data.ts`.
- Produces: `HomeBlogSection` برای استفاده در `HomeView`.

- [ ] **Step 1: Write the failing tests** برای انتخاب سه مطلب، حذف ورودی ناقص، فرمت تاریخ فارسی و حالت بدون مطلب.
- [ ] **Step 2: Run the focused test** با `npm test -- --run src/views/home/components/blog.test.ts` و تأیید شکست قبل از production code.
- [ ] **Step 3: Implement the loader and presentational section** در `blog.tsx`; از `loadBlogIndex({})` یا لودر کوچک‌تر موجود استفاده شود، کارت‌ها به `/blog/[slug]` لینک شوند و در نبود داده `null` برگردند.
- [ ] **Step 4: Place `HomeBlogSection`** بعد از آخرین محتوای صفحهٔ اصلی و قبل از خروج به layout/footer در `src/views/home/index.tsx`.
- [ ] **Step 5: Run focused test** و تأیید سبز شدن تست.
- [ ] **Step 6: Run full verification**: `npm test -- --reporter=dot`, `npx tsc --noEmit`, `npm run lint -- --quiet`, `npm run build`, و `git diff --check`.

### Task 2: Commit and publish

**Files:**
- Modify: همهٔ تغییرات موجود در ورک‌تری، مطابق درخواست کاربر.

- [ ] **Step 1: Review `git status` و diff** برای اطمینان از اینکه تغییرات قبلی کاربر حفظ شده‌اند.
- [ ] **Step 2: Commit all changes** با پیام مشخص.
- [ ] **Step 3: Merge current work into the latest `main` history** در صورت واگرایی و حل تعارض‌ها بدون حذف تغییرات.
- [ ] **Step 4: Push the resulting tip to `origin/main`** و تأیید SHA ریموت.
