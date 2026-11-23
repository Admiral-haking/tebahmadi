'use client';

import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { RefreshRounded, ReplyRounded, SupportAgentRounded } from '@mui/icons-material';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUS_LABELS,
  SUPPORT_STATUSES,
} from '@/support/types';
import type { SupportTicketDTO } from '@/support/types';

type SupportResponse = {
  items: SupportTicketDTO[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  stats: { total: number; open: number; inProgress: number; waitingForCustomer: number; resolved: number; closed: number };
};

const dateFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium', timeStyle: 'short' });

async function fetcher(url: string): Promise<SupportResponse> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) throw new Error((await response.text().catch(() => '')) || 'دریافت تیکت‌ها ناموفق بود.');
  return response.json() as Promise<SupportResponse>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'نامشخص' : dateFormatter.format(date);
}

const statusColor = (status: SupportTicketDTO['status']): 'default' | 'warning' | 'info' | 'success' => {
  if (status === 'resolved' || status === 'closed') return 'success';
  if (status === 'in_progress') return 'info';
  if (status === 'waiting_for_customer') return 'warning';
  return 'default';
};

function buildUrl(page: number, status: string, query: string) {
  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (status) params.set('status', status);
  if (query.trim()) params.set('q', query.trim());
  return `/api/admin/support/tickets?${params.toString()}`;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="h5" fontWeight={900}>{value.toLocaleString('fa-IR')}</Typography>
    </Paper>
  );
}

export default function SupportAdminView() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<SupportTicketDTO | null>(null);
  const [reply, setReply] = useState('');
  const [saving, setSaving] = useState(false);
  const url = useMemo(() => buildUrl(page, status, query), [page, status, query]);
  const { data, error, isLoading, isValidating, mutate } = useSWR(url, fetcher);

  async function saveTicket() {
    if (!selected) return;
    setSaving(true);
    try {
      const response = await fetch('/api/admin/support/tickets', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id, status: selected.status, reply: reply.trim() || undefined }),
      });
      if (!response.ok) throw new Error((await response.text().catch(() => '')) || 'بروزرسانی تیکت ناموفق بود.');
      toast.success('تیکت بروزرسانی شد.');
      setReply('');
      setSelected(null);
      await mutate();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'بروزرسانی تیکت ناموفق بود.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 } }} dir="rtl">
      <Stack spacing={3}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={2}>
          <Box>
            <Typography variant="h4" fontWeight={900}>تیکت‌های پشتیبانی</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>درخواست‌های مشتریان را بررسی، پاسخ و وضعیت آن‌ها را مدیریت کنید.</Typography>
          </Box>
          <Tooltip title="بروزرسانی">
            <IconButton onClick={() => void mutate()} disabled={isValidating}><RefreshRounded /></IconButton>
          </Tooltip>
        </Stack>

        {error ? <Alert severity="error">{error.message}</Alert> : null}

        <Grid container spacing={2}>
          <Grid size={{ xs: 6, md: 2 }}><Stat label="کل تیکت‌ها" value={data?.stats.total ?? 0} /></Grid>
          <Grid size={{ xs: 6, md: 2 }}><Stat label="باز" value={data?.stats.open ?? 0} /></Grid>
          <Grid size={{ xs: 6, md: 2 }}><Stat label="در حال بررسی" value={data?.stats.inProgress ?? 0} /></Grid>
          <Grid size={{ xs: 6, md: 2 }}><Stat label="منتظر مشتری" value={data?.stats.waitingForCustomer ?? 0} /></Grid>
          <Grid size={{ xs: 6, md: 2 }}><Stat label="حل‌شده" value={data?.stats.resolved ?? 0} /></Grid>
          <Grid size={{ xs: 6, md: 2 }}><Stat label="بسته‌شده" value={data?.stats.closed ?? 0} /></Grid>
        </Grid>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField label="جست‌وجو" placeholder="شماره، عنوان یا شماره تماس" value={query} onChange={(event) => { setPage(1); setQuery(event.target.value); }} fullWidth />
            <FormControl sx={{ minWidth: { md: 220 } }}>
              <InputLabel id="support-status-filter">وضعیت</InputLabel>
              <Select labelId="support-status-filter" label="وضعیت" value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }}>
                <MenuItem value="">همه وضعیت‌ها</MenuItem>
                {SUPPORT_STATUSES.map((value) => <MenuItem key={value} value={value}>{SUPPORT_STATUS_LABELS[value]}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>تیکت</TableCell>
                  <TableCell>درخواست‌کننده</TableCell>
                  <TableCell>دسته</TableCell>
                  <TableCell>اولویت</TableCell>
                  <TableCell>وضعیت</TableCell>
                  <TableCell>تاریخ</TableCell>
                  <TableCell align="left">عملیات</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? <TableRow><TableCell colSpan={7}>در حال دریافت…</TableCell></TableRow> : null}
                {!isLoading && (data?.items.length ?? 0) === 0 ? <TableRow><TableCell colSpan={7}>تیکتی پیدا نشد.</TableCell></TableRow> : null}
                {data?.items.map((ticket) => (
                  <TableRow key={ticket.id} hover>
                    <TableCell>
                      <Typography fontWeight={800}>{ticket.title}</Typography>
                      <Typography variant="caption" color="text.secondary" dir="ltr">{ticket.ticketNumber}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{ticket.requesterName || 'مهمان'}</Typography>
                      <Typography variant="caption" color="text.secondary" dir="ltr">{ticket.contactPhone || '—'}</Typography>
                    </TableCell>
                    <TableCell>{SUPPORT_CATEGORY_LABELS[ticket.category]}</TableCell>
                    <TableCell>{SUPPORT_PRIORITY_LABELS[ticket.priority]}</TableCell>
                    <TableCell><Chip size="small" color={statusColor(ticket.status)} label={SUPPORT_STATUS_LABELS[ticket.status]} /></TableCell>
                    <TableCell>{formatDate(ticket.createdAt)}</TableCell>
                    <TableCell align="left">
                      <Button size="small" startIcon={<ReplyRounded />} onClick={() => { setReply(''); setSelected(ticket); }}>بررسی و پاسخ</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {data && data.pagination.totalPages > 1 ? (
            <Stack alignItems="center" sx={{ p: 2 }}>
              <Pagination count={data.pagination.totalPages} page={page} onChange={(_, nextPage) => setPage(nextPage)} color="primary" />
            </Stack>
          ) : null}
        </Paper>
      </Stack>

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} fullWidth maxWidth="md">
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center"><SupportAgentRounded color="primary" /> <span>بررسی تیکت</span></Stack>
        </DialogTitle>
        <DialogContent dividers>
          {selected ? (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Stack direction="row" gap={1} flexWrap="wrap">
                <Chip label={selected.ticketNumber} variant="outlined" />
                <Chip label={SUPPORT_CATEGORY_LABELS[selected.category]} variant="outlined" />
                <Chip label={SUPPORT_PRIORITY_LABELS[selected.priority]} variant="outlined" />
              </Stack>
              <Typography variant="h6" fontWeight={900}>{selected.title}</Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 2 }}>{selected.message}</Typography>
              {selected.attachmentId ? <Button component="a" href={`/api/media/${selected.attachmentId}?type=original`} target="_blank" rel="noreferrer" variant="outlined">مشاهده پیوست</Button> : null}
              {selected.replies.map((item) => <Box key={item.id} sx={{ bgcolor: 'action.hover', p: 1.5, borderRadius: 2 }}><Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{item.body}</Typography><Typography variant="caption" color="text.secondary">پاسخ پشتیبانی · {formatDate(item.createdAt)}</Typography></Box>)}
              <FormControl fullWidth>
                <InputLabel id="support-dialog-status">وضعیت</InputLabel>
                <Select labelId="support-dialog-status" label="وضعیت" value={selected.status} onChange={(event) => setSelected({ ...selected, status: event.target.value as SupportTicketDTO['status'] })}>
                  {SUPPORT_STATUSES.map((value) => <MenuItem key={value} value={value}>{SUPPORT_STATUS_LABELS[value]}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField label="پاسخ پشتیبانی" value={reply} onChange={(event) => setReply(event.target.value)} multiline minRows={4} placeholder="پاسخ خود را بنویسید" fullWidth />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)} disabled={saving}>انصراف</Button>
          <Button variant="contained" onClick={() => void saveTicket()} disabled={saving || !selected}>{saving ? 'در حال ذخیره…' : 'ذخیره تغییرات'}</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
