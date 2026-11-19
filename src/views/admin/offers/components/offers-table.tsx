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
} from "@mui/material";
import Link from "next/link";
import { toast } from "sonner";

import type { OfferListItem } from "..";

interface OffersTableProps {
  items: OfferListItem[];
}

function formatAmount(type: string, amount?: number): string {
  if (amount == null) return '-';
  if (type === 'percentage') {
    return `${amount}%`;
  }
  return `${new Intl.NumberFormat('fa-IR').format(amount)} تومان`;
}

export default function OffersTable({ items }: OffersTableProps) {
  const handleDelete = async (id: string, code: string) => {
    if (!window.confirm(`آیا از غیرفعال کردن کوپن «${code}» مطمئن هستید؟`)) {
      return;
    }

    const response = await fetch(`/api/offers/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const message = (await response.text().catch(() => '')) || response.statusText;
      toast.error(message || 'غیرفعال‌سازی با خطا مواجه شد');
      return;
    }

    toast.success('کوپن غیرفعال شد');
    window.location.reload();
  };

  return (
    <Card>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>کد</TableCell>
              <TableCell>نوع</TableCell>
              <TableCell>مقدار</TableCell>
              <TableCell>محدودیت‌ها</TableCell>
              <TableCell>بازه زمانی</TableCell>
              <TableCell align="right">وضعیت</TableCell>
              <TableCell align="right">عملیات</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell>
                  <Typography fontWeight={600}>{item.code}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    استفاده شده: {item.timesRedeemed}
                  </Typography>
                </TableCell>
                <TableCell>{item.type}</TableCell>
                <TableCell>{formatAmount(item.type, item.amount)}</TableCell>
                <TableCell>
                  <Stack spacing={0.5}>
                    <Typography variant="body2">
                      کل: {item.usageLimitTotal ?? 'نامحدود'}
                    </Typography>
                    <Typography variant="body2">
                      هر کاربر: {item.usageLimitPerUser ?? 'نامحدود'}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Stack spacing={0.5}>
                    <Typography variant="body2">
                      از: {item.startsAt ? new Date(item.startsAt).toLocaleDateString('fa-IR') : '---'}
                    </Typography>
                    <Typography variant="body2">
                      تا: {item.endsAt ? new Date(item.endsAt).toLocaleDateString('fa-IR') : '---'}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  <Chip
                    label={item.isActive ? 'فعال' : 'غیرفعال'}
                    color={item.isActive ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="ویرایش">
                    <IconButton LinkComponent={Link} href={`/admin/offers/save?id=${item.id}`} aria-label="edit offer">
                      <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                        <circle cx={12} cy={12} r={10} fill="currentColor" opacity={0.5}></circle>
                        <path
                          fill="currentColor"
                          d="M13.926 14.302c.245-.191.467-.413.912-.858l5.54-5.54c.134-.134.073-.365-.106-.427a6.1 6.1 0 0 1-2.3-1.449a6.1 6.1 0 0 1-1.45-2.3c-.061-.18-.292-.24-.426-.106l-5.54 5.54c-.445.444-.667.667-.858.912a5 5 0 0 0-.577.932c-.133.28-.233.579-.431 1.175l-.257.77l-.409 1.226l-.382 1.148a.817.817 0 0 0 1.032 1.033l1.15-.383l1.224-.408l.77-.257c.597-.199.895-.298 1.175-.432q.498-.237.933-.576m8.187-8.132a3.028 3.028 0 0 0-4.282-4.283l-.179.178a.73.73 0 0 0-.206.651c.027.15.077.37.168.633a4.9 4.9 0 0 0 1.174 1.863a4.9 4.9 0 0 0 1.862 1.174c.263.09.483.141.633.168c.24.043.48-.035.652-.207z"
                        ></path>
                      </svg>
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="غیرفعال‌سازی">
                    <IconButton aria-label="disable offer" onClick={() => handleDelete(item.id, item.code)}>
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
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}

            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  هیچ کوپنی ثبت نشده است.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}
