"use client";

import { useState, type ChangeEvent } from "react";
import Link from "next/link";
import { PageJumper } from "@/components/search/pagination";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Pagination,
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
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { PageListItem, PageStatus } from "..";

interface PageTableProps {
  pages: PageListItem[];
  loading: boolean;
  currentPage: number;
  totalPages: number;
  currentStatuses: PageStatus[];
  query?: string;
  totalResults: number;
  onRefresh: () => void;
}

const STATUS_LABELS: Record<PageStatus, string> = {
  published: "منتشر شده",
  draft: "پیش‌نویس",
  archived: "آرشیوشده",
};

const STATUS_COLORS: Record<PageStatus, { border: string; color: "default" | "success" | "warning" }> = {
  published: {
    border: "rgba(var(--mui-palette-success-mainChannel) / 0.4)",
    color: "success",
  },
  draft: {
    border: "rgba(var(--mui-palette-warning-mainChannel) / 0.4)",
    color: "warning",
  },
  archived: {
    border: "rgba(var(--mui-palette-text-primaryChannel) / 0.4)",
    color: "default",
  },
};

function buildPageHref(page: number, statuses: PageStatus[], query?: string): string {
  const params = new URLSearchParams();
  if (page > 1) {
    params.set("page", String(page));
  }
  statuses.forEach((status) => params.append("status", status));
  if (query && query.trim()) {
    params.set("q", query.trim());
  }
  const qs = params.toString();
  return qs ? `/admin/pages?${qs}` : "/admin/pages";
}

export default function PageTable({
  pages,
  loading,
  currentPage,
  totalPages,
  currentStatuses,
  query,
  totalResults,
  onRefresh,
}: PageTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handlePageChange = (_event: ChangeEvent<unknown>, value: number) => {
    router.push(buildPageHref(value, currentStatuses, query), { scroll: true });
  };

  const handleDelete = async (page: PageListItem) => {
    const confirmed = window.confirm(`آیا از انتقال صفحه «${page.title}» به آرشیو مطمئن هستید؟`);
    if (!confirmed) return;

    setDeletingId(page.id);
    try {
      const response = await fetch(`/api/pages/${page.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const message = (await response.text().catch(() => "")) || response.statusText;
        throw new Error(message || "انتقال صفحه به آرشیو با خطا مواجه شد");
      }

      toast.success("صفحه به آرشیو منتقل شد");
      onRefresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "انتقال صفحه به آرشیو با خطا مواجه شد";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 4 }}>
      <CardContent>
        <Stack spacing={3}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
            <Typography variant="h6" fontWeight={700}>
              لیست صفحات
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {totalResults > 0
                ? `${totalResults.toLocaleString("fa-IR")} نتیجه پیدا شد`
                : "نتیجه‌ای مطابق فیلترهای فعلی یافت نشد"}
            </Typography>
          </Stack>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>عنوان</TableCell>
                  <TableCell>اسلاگ</TableCell>
                  <TableCell>وضعیت</TableCell>
                  <TableCell>انتشار</TableCell>
                  <TableCell>آخرین بروزرسانی</TableCell>
                  <TableCell align="right">عملیات</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && pages.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Stack spacing={2} alignItems="center" py={4}>
                        <CircularProgress size={24} />
                        <Typography variant="body2" color="text.secondary">
                          در حال بارگذاری صفحات...
                        </Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )}
                {pages.map((page) => (
                  <TableRow key={page.id} hover sx={{ transition: "all .2s ease", "&:hover": { bgcolor: "rgba(var(--mui-palette-primary-mainChannel) / 0.04)" } }}>
                    <TableCell>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar sx={{ bgcolor: "rgba(var(--mui-palette-primary-mainChannel) / 0.12)", color: "primary.main", fontWeight: 700 }}>
                          {page.title.slice(0, 2).toUpperCase()}
                        </Avatar>
                        <Stack spacing={0.5}>
                          <Typography fontWeight={700}>{page.title}</Typography>
                          {page.seoTitle && (
                            <Typography variant="caption" color="text.secondary">
                              عنوان سئو: {page.seoTitle}
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary">
                            {page.excerpt || "بدون توضیح"}
                          </Typography>
                        </Stack>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        /{page.slug}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={STATUS_LABELS[page.status]}
                        color={STATUS_COLORS[page.status].color}
                        variant={page.status === "archived" ? "outlined" : "filled"}
                        sx={{
                          borderColor: STATUS_COLORS[page.status].border,
                          fontWeight: 600,
                          borderRadius: 2,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <Typography variant="body2">{page.publishedAtLabel}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {page.publishedAt ? "دارای تاریخ انتشار" : "در انتظار انتشار"}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{page.updatedAtLabel}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Tooltip title="مشاهده در سایت">
                          <IconButton
                            LinkComponent={Link}
                            href={`/page/${page.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            size="small"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24">
                              <path
                                fill="currentColor"
                                d="M15 2v2h3.59l-9 9L11 14.41l9-9V9h2V2z"
                              ></path>
                              <path
                                fill="currentColor"
                                d="M5 5h5V3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-5h-2v5H5z"
                              ></path>
                            </svg>
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="ویرایش">
                          <IconButton
                            LinkComponent={Link}
                            href={`/admin/pages/save?id=${page.id}`}
                            size="small"
                            sx={{ bgcolor: "rgba(var(--mui-palette-primary-mainChannel) / 0.08)" }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24">
                              <path
                                fill="currentColor"
                                d="M3 17.25V21h3.75l11.04-11.04l-3.75-3.75z"
                              ></path>
                              <path
                                fill="currentColor"
                                d="M20.71 7.04a1.004 1.004 0 0 0 0-1.42l-2.34-2.34a1.004 1.004 0 0 0-1.42 0l-1.83 1.83l3.75 3.75z"
                              ></path>
                            </svg>
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="انتقال به آرشیو">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleDelete(page)}
                              disabled={loading || deletingId === page.id}
                              sx={{ bgcolor: "rgba(var(--mui-palette-error-mainChannel) / 0.08)", color: "error.main" }}
                            >
                              {deletingId === page.id ? (
                                <CircularProgress size={18} />
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24">
                                  <path
                                    fill="currentColor"
                                    d="M15.535 4L14.06 2.525A1.988 1.988 0 0 0 12.636 2h-1.272c-.53 0-1.039.211-1.414.586L8.475 4H5a1 1 0 0 0 0 2h.159l.674 12.123A2 2 0 0 0 7.83 20h8.34a2 2 0 0 0 1.997-1.877L18.841 6H19a1 1 0 1 0 0-2zM12 17a1 1 0 0 1-1-1v-5a1 1 0 1 1 2 0v5a1 1 0 0 1-1 1"
                                  ></path>
                                </svg>
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {pages.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Stack spacing={2} alignItems="center" py={6}>
                        <Box
                          sx={{
                            width: 64,
                            height: 64,
                            borderRadius: "50%",
                            bgcolor: "rgba(var(--mui-palette-primary-mainChannel) / 0.08)",
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width={32} height={32} viewBox="0 0 24 24">
                            <path
                              fill="currentColor"
                              d="M19 3H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l-1 3l4-3h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m-7 10H7v-2h5zm5-4H7V7h10z"
                            ></path>
                          </svg>
                        </Box>
                        <Typography variant="subtitle1" fontWeight={600}>
                          صفحه‌ای برای نمایش وجود ندارد
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          فیلترها را تغییر دهید یا صفحه جدیدی بسازید.
                        </Typography>
                        <Button LinkComponent={Link} href="/admin/pages/save" variant="contained">
                          ایجاد صفحه جدید
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {pages.length > 0 && totalPages > 1 && (
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="caption" color="text.secondary">
                صفحه {currentPage.toLocaleString("fa-IR")} از {totalPages.toLocaleString("fa-IR")}
              </Typography>
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={handlePageChange}
                shape="rounded"
                color="primary"
                sx={{
                  "& .MuiPaginationItem-root": {
                    borderRadius: 2,
                  },
                }}
              />
              <PageJumper pages={totalPages} onJump={(p) => handlePageChange({} as ChangeEvent<unknown>, p)} />
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
