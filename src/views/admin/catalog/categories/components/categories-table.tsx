"use client";

import {
  Card,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  Stack,
  Skeleton,
} from "@mui/material";
import Link from "next/link";
import { toast } from "sonner";

import type { CategoryListItem } from "..";

interface CategoriesTableProps {
  categories: CategoryListItem[];
  onOpen: (id: string) => any
  loading: boolean
}

export default function CategoriesTable({ categories, onOpen, loading }: CategoriesTableProps) {
  async function handleDelete(category: CategoryListItem) {
    if (category.childCount > 0) {
      toast.error("ابتدا زیردسته‌های این دسته‌بندی را حذف کنید");
      return;
    }
    const confirmed = window.confirm(`آیا از حذف «${category.name}» مطمئن هستید؟`);
    if (!confirmed) return;

    const response = await fetch(`/api/catalog/categories/${category.id}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const message = (await response.text().catch(() => "")) || response.statusText;
      toast.error(message || "حذف دسته‌بندی با خطا مواجه شد");
      return;
    }

    toast.success("دسته‌بندی با موفقیت حذف شد");
    window.location.reload();
  }

  return (
    <Card>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>عنوان</TableCell>
              <TableCell>نوع محصول</TableCell>
              <TableCell align="right">وضعیت</TableCell>
              <TableCell align="right" width={180}>عملیات</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ?
              new Array(10).fill(13).map((x, y) => <TableRow key={x + y}>
                <TableCell colSpan={4}>
                  <Skeleton
                    height={32}
                    width="100% "
                  />
                </TableCell>
              </TableRow>) :
              categories.map((category) => (
                <TableRow key={category.id} hover>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography fontWeight={600} sx={{ pl: category.depth * 2 }}>
                        {category.name}
                      </Typography>
                      {category.parentId && (
                        <Typography variant="caption" color="text.secondary">
                          شناسه والد: {category.parentId}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {category.productTypeName ? (
                      <Stack spacing={0.25}>
                        <Typography variant="body2">{category.productTypeName}</Typography>
                        {category.productTypeInherited && (
                          <Typography variant="caption" color="text.secondary">
                            ارث‌بری از والد
                          </Typography>
                        )}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        -
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      label={category.isActive ? "فعال" : "غیرفعال"}
                      color={category.isActive ? "success" : "default"}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={category.childCount > 0 ? "ابتدا زیردسته‌ها را حذف کنید" : "حذف"}>
                      <span>
                        <IconButton
                          aria-label="delete category"
                          onClick={() => handleDelete(category)}
                          disabled={category.childCount > 0}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                            <path
                              fill="currentColor"
                              d="M2.75 6.167c0-.46.345-.834.771-.834h2.665c.529-.015.996-.378 1.176-.916l.03-.095l.115-.372c.07-.228.131-.427.217-.605c.338-.702.964-1.189 1.687-1.314c.184-.031.377-.031.6-.031h3.478c.223 0 .417 0 .6.031c.723.125 1.35.612 1.687 1.314c.086.178.147.377.217.605l.115.372l.03.095c.18.538.74.902 1.27.916h2.57c.427 0 .772.373.772.834S20.405 7 19.979 7H3.52c-.426 0-.771-.373-.771-.833"
                            ></path>
                            <path
                              fill="currentColor"
                              d="M11.607 22h.787c2.707 0 4.06 0 4.941-.863c.88-.864.97-2.28 1.15-5.111l.26-4.081c.098-1.537.147-2.305-.295-2.792s-1.187-.487-2.679-.487H8.23c-1.491 0-2.237 0-2.679.487s-.392 1.255-.295 2.792l.26 4.08c.18 2.833.27 4.248 1.15 5.112S8.9 22 11.607 22"
                              opacity={0.5}
                            ></path>
                          </svg>
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="ویرایش">
                      <IconButton
                        LinkComponent={Link}
                        href={`/admin/catalog/categories/save?id=${category.id}`}
                        aria-label="edit category"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                          <circle cx={12} cy={12} r={10} fill="currentColor" opacity={0.5}></circle>
                          <path
                            fill="currentColor"
                            d="M13.926 14.302c.245-.191.467-.413.912-.858l5.54-5.54c.134-.134.073-.365-.106-.427a6.1 6.1 0 0 1-2.3-1.449a6.1 6.1 0 0 1-1.45-2.3c-.061-.18-.292-.24-.426-.106l-5.54 5.54c-.445.444-.667.667-.858.912a5 5 0 0 0-.577.932c-.133.28-.233.579-.431 1.175l-.257.77l-.409 1.226l-.382 1.148a.817.817 0 0 0 1.032 1.033l1.15-.383l1.224-.408l.77-.257c.597-.199.895-.298 1.175-.432q.498-.237.933-.576m8.187-8.132a3.028 3.028 0 0 0-4.282-4.283l-.179.178a.73.73 0 0 0-.206.651c.027.15.077.37.168.633a4.9 4.9 0 0 0 1.174 1.863a4.9 4.9 0 0 0 1.862 1.174c.263.09.483.141.633.168c.24.043.48-.035.652-.207z"
                          ></path>
                        </svg>
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="نمایش زیر مجموعه ها">
                      <IconButton
                        aria-label="see sub categories"
                        onClick={() => onOpen(category.id)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                          <path fill="currentColor" fillRule="evenodd" d="M3.358 12.779c-.61.941-.358 2.25.145 4.868c.363 1.885.544 2.827 1.172 3.452q.246.244.544.429C5.982 22 6.995 22 9.022 22h6.956c2.027 0 3.04 0 3.803-.472q.298-.185.544-.429c.628-.625.81-1.567 1.172-3.452c.503-2.618.755-3.927.145-4.868a3 3 0 0 0-.57-.646c-.87-.735-2.279-.735-5.094-.735H9.022c-2.815 0-4.223 0-5.094.735a3 3 0 0 0-.57.646m6.337 4.402c0-.4.343-.723.765-.723h4.08c.422 0 .765.323.765.723s-.343.723-.765.723h-4.08c-.422 0-.765-.324-.765-.723" clipRule="evenodd"></path>
                          <path fill="currentColor" d="M3.576 12.485q.16-.19.352-.352c.87-.735 2.279-.735 5.094-.735h6.956c2.815 0 4.223 0 5.094.735q.192.162.353.353v-2.73c0-.91 0-1.663-.086-2.264c-.09-.635-.286-1.197-.755-1.66a3 3 0 0 0-.242-.214c-.512-.408-1.125-.575-1.82-.652c-.669-.074-1.512-.074-2.545-.074h-.353c-.982 0-1.334-.006-1.653-.087a2.7 2.7 0 0 1-.536-.196c-.284-.14-.532-.351-1.227-.968l-.474-.42c-.2-.176-.335-.296-.48-.403a4.3 4.3 0 0 0-2.183-.803A8 8 0 0 0 8.414 2h-.117c-.64 0-1.063 0-1.43.061c-1.605.268-2.903 1.39-3.22 2.875c-.071.337-.071.724-.07 1.283z" opacity={0.5}></path>
                        </svg>
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            {categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  دسته‌بندی‌ای یافت نشد.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}
