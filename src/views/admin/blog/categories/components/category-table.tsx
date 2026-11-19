"use client";

import Link from "next/link";
import {
  Card,
  Chip,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { toast } from "sonner";

import type { BlogCategoryListItem } from "..";

interface CategoriesTableProps {
  categories: BlogCategoryListItem[];
}

export default function CategoriesTable({ categories }: CategoriesTableProps) {
  async function handleDelete(category: BlogCategoryListItem) {
    if (category.childCount > 0) {
      toast.error("ابتدا زیردسته‌های این دسته را حذف کنید.");
      return;
    }
    if (category.postCount > 0) {
      toast.error("این دسته به نوشته‌های منتشر شده متصل است.");
      return;
    }
    const confirmed = window.confirm(`آیا از حذف «${category.name}» مطمئن هستید؟`);
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/blog/categories/${category.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const message = (await response.text().catch(() => "")) || response.statusText;
        toast.error(message || "حذف دسته با خطا مواجه شد.");
        return;
      }

      toast.success("دسته با موفقیت حذف شد.");
      window.location.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "حذف دسته با خطا مواجه شد.";
      toast.error(message);
    }
  }

  return (
    <Card variant="outlined" sx={{ borderRadius: 4 }}>
      <TableContainer>
        <Table size="medium">
          <TableHead>
            <TableRow>
              <TableCell>عنوان</TableCell>
              <TableCell>اسلاگ</TableCell>
              <TableCell>مسیر</TableCell>
              <TableCell align="right">موقعیت</TableCell>
              <TableCell align="right">نوشته‌ها</TableCell>
              <TableCell align="right">وضعیت</TableCell>
              <TableCell align="right">عملیات</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {categories.map((category) => {
              const canDelete = category.childCount === 0 && category.postCount === 0;

              return (
                <TableRow key={category.id} hover>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography fontWeight={600} sx={{ pl: category.depth * 2 }}>
                        {category.name}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {typeof category.parentId === "string" && category.parentId.length > 0 && (
                          <Chip size="small" label={`والد: ${category.parentId}`} color="default" variant="outlined" />
                        )}
                        <Chip size="small" label={`زیرشاخه: ${category.childCount}`} color="default" variant="outlined" />
                      </Stack>
                      {category.updatedAt && (
                        <Typography variant="caption" color="text.secondary">
                          آخرین بروزرسانی: {new Date(category.updatedAt).toLocaleString("fa-IR")}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>{category.slug}</TableCell>
                  <TableCell>{category.path}</TableCell>
                  <TableCell align="right">{category.position ?? "-"}</TableCell>
                  <TableCell align="right">
                    <Chip
                      label={category.postCount.toLocaleString("fa-IR")}
                      color={category.postCount > 0 ? "primary" : "default"}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      label={category.isActive ? "فعال" : "غیرفعال"}
                      color={category.isActive ? "success" : "default"}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" justifyContent="flex-end" spacing={1}>
                      <Tooltip title="ویرایش">
                        <IconButton
                          LinkComponent={Link}
                          href={`/admin/blog/categories/save?id=${category.id}`}
                          aria-label="ویرایش دسته"
                          color="primary"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24">
                            <path
                              fill="currentColor"
                              d="M13.296 6.136L5.38 14.05a1.5 1.5 0 0 0-.387.676l-1.47 5.148a.75.75 0 0 0 .928.927l5.148-1.47a1.5 1.5 0 0 0 .676-.386l7.917-7.917c-.046-.145-.086-.29-.12-.437c-.43-1.843.185-3.801 1.615-5.231l.862-.861a.75.75 0 0 0 0-1.061l-.53-.53a2.799 2.799 0 0 0-3.96 0l-.862.861c-1.43 1.43-3.388 2.045-5.23 1.616a3 3 0 0 0-.439-.121"
                            ></path>
                            <path
                              fill="currentColor"
                              d="M21.742 12.897a.75.75 0 0 1 1.5.211c-.176 1.248-.726 2.44-1.662 3.375c-1.442 1.442-3.394 2.05-5.243 1.615a.75.75 0 1 1 .33-1.464c1.28.288 2.66-.137 3.65-1.128c.662-.662 1.08-1.519 1.243-2.43M9.55 22.592a.75.75 0 0 1-1.464.33c-.435-1.85.173-3.8 1.615-5.242c.935-.935 2.127-1.486 3.375-1.662a.75.75 0 0 1 .212 1.5c-.912.162-1.768.58-2.43 1.242c-.99.99-1.415 2.37-1.308 3.832"
                            ></path>
                          </svg>
                        </IconButton>
                      </Tooltip>
                      <Tooltip
                        title={
                          canDelete
                            ? "حذف"
                            : category.childCount > 0
                              ? "ابتدا زیردسته‌ها را حذف کنید"
                              : "ابتدا نوشته‌های مرتبط را جابجا یا حذف کنید"
                        }
                      >
                        <span>
                          <IconButton
                            aria-label="حذف دسته"
                            color="error"
                            disabled={!canDelete}
                            onClick={() => handleDelete(category)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24">
                              <path
                                fill="currentColor"
                                d="M18 5h-3.5l-.71-.71C13.54 3.54 13.28 3 12.5 3h-1c-.78 0-1.04.54-1.29.79L9.5 5H6c-.55 0-1 .45-1 1s.45 1 1 1h12c.55 0 1-.45 1-1s-.45-1-1-1"
                              ></path>
                              <path
                                fill="currentColor"
                                d="M17 21H7c-1.1 0-2-.9-2-2V8h14v11c0 1.1-.9 2-2 2"
                                opacity={0.5}
                              ></path>
                            </svg>
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
            {categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary">
                    دسته‌ای مطابق جستجو یافت نشد.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}
