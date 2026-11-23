"use client";

import Link from "next/link";
import {
  Box,
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

import Pagination from "@/components/search/pagination";

import type { BlogPostListItem, BlogPostStatus } from "..";

interface PostsTableProps {
  items: BlogPostListItem[];
  page: number;
  pages: number;
  total: number;
}

const STATUS_STYLES: Record<BlogPostStatus, { label: string; color: "default" | "primary" | "success" | "warning" }> =
  {
    draft: { label: "پیش‌نویس", color: "warning" },
    published: { label: "منتشر شده", color: "success" },
    archived: { label: "آرشیو", color: "default" },
  };

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "—";
  return date.toLocaleString("fa-IR-u-ca-persian", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function PostsTable({ items, page, pages, total }: PostsTableProps) {
  async function handleArchive(post: BlogPostListItem) {
    const confirmed = window.confirm(`آیا از انتقال «${post.title}» به آرشیو مطمئن هستید؟`);
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/blog/posts/${post.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const message = (await response.text().catch(() => "")) || response.statusText;
        throw new Error(message || "عملیات با خطا مواجه شد.");
      }

      toast.success("نوشته به آرشیو منتقل شد.");
      window.location.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "عملیات با خطا مواجه شد.";
      toast.error(message);
    }
  }

  return (
    <Card variant="outlined" sx={{ borderRadius: 4 }}>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>عنوان</TableCell>
              <TableCell>دسته‌ها</TableCell>
              <TableCell align="right">وضعیت</TableCell>
              <TableCell align="right">انتشار</TableCell>
              <TableCell align="right">آخرین ویرایش</TableCell>
              <TableCell align="right">عملیات</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((post) => {
              const statusMeta = STATUS_STYLES[post.status];
              return (
                <TableRow key={post.id} hover>
                  <TableCell>
                    <Stack spacing={0.75}>
                      <Typography variant="subtitle1" fontWeight={700}>
                        {post.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        اسلاگ: {post.slug}
                      </Typography>
                      {post.excerpt && (
                        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520 }}>
                          {post.excerpt}
                        </Typography>
                      )}
                      {post.tags.length > 0 && (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap">
                          {post.tags.map((tag) => (
                            <Chip key={tag} label={`#${tag}`} size="small" variant="outlined" />
                          ))}
                        </Stack>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" flexWrap="wrap" spacing={0.5}>
                      {post.categories.length > 0 ? (
                        post.categories.map((category) => (
                          <Chip key={category.id} label={category.name} size="small" />
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          بدون دسته
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      label={statusMeta.label}
                      color={statusMeta.color}
                      size="small"
                      variant={post.status === "archived" ? "outlined" : "filled"}
                    />
                  </TableCell>
                  <TableCell align="right">{formatDate(post.publishedAt)}</TableCell>
                  <TableCell align="right">{formatDate(post.updatedAt ?? post.createdAt)}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" justifyContent="flex-end" spacing={1}>
                      <Tooltip title="ویرایش">
                        <IconButton
                          LinkComponent={Link}
                          href={`/admin/blog/posts/save?id=${post.id}`}
                          color="primary"
                          aria-label="ویرایش نوشته"
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
                      <Tooltip title="مشاهده در وب‌سایت">
                        <IconButton
                          LinkComponent={Link}
                          href={`/blog/${post.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="مشاهده نوشته"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24">
                            <path
                              fill="currentColor"
                              d="M4.5 5A2.5 2.5 0 0 1 7 2.5h4A2.5 2.5 0 0 1 13.5 5v14A2.5 2.5 0 0 1 11 21.5H7A2.5 2.5 0 0 1 4.5 19z"
                              opacity={0.5}
                            ></path>
                            <path
                              fill="currentColor"
                              d="M17 6.5A2.5 2.5 0 0 0 14.5 4h-1A1.5 1.5 0 0 1 12 2.5H17A2.5 2.5 0 0 1 19.5 5v14A2.5 2.5 0 0 1 17 21.5h-5a1.5 1.5 0 0 0 1.5-1.5v-2.5H17A2.5 2.5 0 0 0 19.5 15z"
                            ></path>
                          </svg>
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="انتقال به آرشیو">
                        <span>
                          <IconButton
                            color="error"
                            aria-label="انتقال به آرشیو"
                            onClick={() => handleArchive(post)}
                            disabled={post.status === "archived"}
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
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="text.secondary">
                    نوشته‌ای مطابق فیلترهای فعلی یافت نشد.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Box px={3} py={2} display="flex" alignItems="center" justifyContent="space-between">
        <Typography variant="caption" color="text.secondary">
          {total.toLocaleString("fa-IR")} نتیجه
        </Typography>
        <Pagination page={page} pages={pages} />
      </Box>
    </Card>
  );
}
