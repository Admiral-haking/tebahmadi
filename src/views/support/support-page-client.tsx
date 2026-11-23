'use client';

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  Link as MuiLink,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AttachmentRounded, HeadsetMicRounded, PhoneRounded, ScheduleRounded, SendRounded } from '@mui/icons-material';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useAuth } from '@/auth/auth-context';
import {
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_PRIORITIES,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_STATUS_LABELS,
} from '@/support/types';
import type { SupportTicketDTO } from '@/support/types';

export interface SupportPageConfig {
  appName: string;
  phones: Array<{ label: string; number: string }>;
  socials: Array<{ platform: string; url: string }>;
  addresses: Array<{ label: string; address: string }>;
  support: {
    title: string;
    description: string;
    hours: string;
    responseTime: string;
    ticketEnabled: boolean;
  };
}

type TicketForm = {
  title: string;
  category: (typeof SUPPORT_CATEGORIES)[number];
  priority: (typeof SUPPORT_PRIORITIES)[number];
  message: string;
  phone: string;
};

const initialForm: TicketForm = {
  title: '',
  category: 'general',
  priority: 'normal',
  message: '',
  phone: '',
};

const socialLabels: Record<string, string> = {
  telegram: 'تلگرام',
  whatsapp: 'واتساپ',
  instagram: 'اینستاگرام',
  baleh: 'بله',
  eeta: 'ایتا',
  rubika: 'روبیکا',
  globalAddress: 'آدرس پیام‌رسان‌ها',
};

function errorMessage(response: Response, fallback: string): Promise<string> {
  return response.json()
    .then((body: { error?: string }) => body.error || fallback)
    .catch(() => fallback);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'نامشخص'
    : new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function SupportPageClient({ config }: { config: SupportPageConfig }) {
  const { user } = useAuth();
  const [form, setForm] = useState<TicketForm>(initialForm);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);
  const [tickets, setTickets] = useState<SupportTicketDTO[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  const hasChannels = config.phones.length > 0 || config.socials.length > 0 || config.addresses.length > 0;
  const contactDescription = useMemo(
    () => config.support.description || `راه‌های ارتباطی ${config.appName} را از همین صفحه ببینید.`,
    [config.appName, config.support.description],
  );

  useEffect(() => {
    if (!user) {
      setTickets([]);
      return;
    }
    let cancelled = false;
    setTicketsLoading(true);
    fetch('/api/support/tickets', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error(await errorMessage(response, 'دریافت تیکت‌ها ناموفق بود.'));
        return response.json() as Promise<{ data?: SupportTicketDTO[] }>;
      })
      .then((body) => {
        if (!cancelled) setTickets(body.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setTickets([]);
      })
      .finally(() => {
        if (!cancelled) setTicketsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  function updateField<K extends keyof TicketForm>(field: K, value: TicketForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    if (!config.support.ticketEnabled) return;
    if (!form.title.trim() || form.message.trim().length < 10) {
      setFeedback({ severity: 'error', message: 'عنوان و شرح درخواست را کامل کنید.' });
      return;
    }
    if (!user && !form.phone.trim()) {
      setFeedback({ severity: 'error', message: 'برای پیگیری تیکت، شماره موبایل خود را وارد کنید.' });
      return;
    }

    const body = new FormData();
    body.append('title', form.title.trim());
    body.append('category', form.category);
    body.append('priority', form.priority);
    body.append('message', form.message.trim());
    if (form.phone.trim()) body.append('phone', form.phone.trim());
    if (attachment) body.append('attachment', attachment);

    setSubmitting(true);
    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        credentials: 'include',
        body,
      });
      if (!response.ok) throw new Error(await errorMessage(response, 'ثبت تیکت ناموفق بود.'));
      const result = await response.json() as { data?: SupportTicketDTO };
      const created = result.data;
      setFeedback({
        severity: 'success',
        message: created ? `تیکت شما با شماره ${created.ticketNumber} ثبت شد.` : 'تیکت شما با موفقیت ثبت شد.',
      });
      setForm(initialForm);
      setAttachment(null);
      if (user && created) setTickets((current) => [created, ...current]);
    } catch (error) {
      setFeedback({ severity: 'error', message: error instanceof Error ? error.message : 'ثبت تیکت ناموفق بود.' });
    } finally {
      setSubmitting(false);
    }
  }

  function handleAttachment(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (file && !file.type.startsWith('image/')) {
      setFeedback({ severity: 'error', message: 'فقط فایل تصویری برای پیوست مجاز است.' });
      setAttachment(null);
      return;
    }
    if (file && file.size > 8 * 1024 * 1024) {
      setFeedback({ severity: 'error', message: 'حجم تصویر پیوست باید کمتر از ۸ مگابایت باشد.' });
      setAttachment(null);
      return;
    }
    setAttachment(file);
  }

  return (
    <Box sx={{ bgcolor: 'background.default', py: { xs: 3, md: 6 } }}>
      <Stack spacing={{ xs: 3, md: 4 }} sx={{ width: 'min(1120px, calc(100% - 32px))', mx: 'auto' }}>
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
            <Stack alignItems="center" spacing={1} textAlign="center">
              <HeadsetMicRounded color="primary" sx={{ fontSize: 40 }} />
              <Typography component="h1" variant="h4" fontWeight={900}>{config.support.title}</Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 720, lineHeight: 2 }}>{contactDescription}</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} divider={<Divider orientation="vertical" flexItem />}>
                {config.support.hours ? <Typography variant="body2">ساعات پاسخ‌گویی: {config.support.hours}</Typography> : null}
                {config.support.responseTime ? <Typography variant="body2">{config.support.responseTime}</Typography> : null}
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Grid container spacing={3} alignItems="flex-start">
          <Grid size={{ xs: 12, md: 7 }}>
            <Card component="form" onSubmit={submitTicket} variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                <Stack spacing={2.25}>
                  <Stack spacing={0.5}>
                    <Typography variant="h6" fontWeight={900}>ثبت تیکت پشتیبانی</Typography>
                    <Typography variant="body2" color="text.secondary">درخواست شما در پنل پشتیبانی ثبت و قابل پیگیری می‌شود.</Typography>
                  </Stack>

                  {!config.support.ticketEnabled ? (
                    <Alert severity="info">ثبت تیکت در حال حاضر غیرفعال است. لطفاً از راه‌های ارتباطی فعال استفاده کنید.</Alert>
                  ) : null}

                  {!user ? (
                    <TextField
                      label="شماره موبایل برای پیگیری *"
                      value={form.phone}
                      onChange={(event) => updateField('phone', event.target.value)}
                      inputProps={{ dir: 'ltr' }}
                      fullWidth
                    />
                  ) : null}

                  <TextField
                    label="عنوان تیکت *"
                    value={form.title}
                    onChange={(event) => updateField('title', event.target.value)}
                    placeholder="عنوان درخواست خود را وارد کنید"
                    fullWidth
                  />

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControl fullWidth>
                        <InputLabel id="support-category-label">بخش</InputLabel>
                        <Select
                          labelId="support-category-label"
                          label="بخش"
                          value={form.category}
                          onChange={(event) => updateField('category', event.target.value as TicketForm['category'])}
                        >
                          {SUPPORT_CATEGORIES.map((value) => <MenuItem key={value} value={value}>{SUPPORT_CATEGORY_LABELS[value]}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControl fullWidth>
                        <InputLabel id="support-priority-label">اولویت</InputLabel>
                        <Select
                          labelId="support-priority-label"
                          label="اولویت"
                          value={form.priority}
                          onChange={(event) => updateField('priority', event.target.value as TicketForm['priority'])}
                        >
                          {SUPPORT_PRIORITIES.map((value) => <MenuItem key={value} value={value}>{SUPPORT_PRIORITY_LABELS[value]}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>

                  <TextField
                    label="شرح درخواست *"
                    value={form.message}
                    onChange={(event) => updateField('message', event.target.value)}
                    placeholder="شرح درخواست خود را بنویسید"
                    multiline
                    minRows={5}
                    fullWidth
                  />

                  <Button component="label" variant="outlined" startIcon={<AttachmentRounded />} sx={{ alignSelf: 'flex-start' }}>
                    {attachment ? attachment.name : 'پیوست تصویر (اختیاری)'}
                    <input hidden type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={handleAttachment} />
                  </Button>

                  {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}

                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    startIcon={<SendRounded />}
                    disabled={submitting || !config.support.ticketEnabled}
                  >
                    {submitting ? 'در حال ثبت…' : 'ثبت تیکت'}
                  </Button>
                  {!user ? (
                    <Typography variant="caption" color="text.secondary">
                      برای ثبت تیکت لازم نیست حساب داشته باشید؛ شماره‌ای وارد کنید که امکان پیگیری آن را دارید.
                    </Typography>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 5 }}>
            <Stack spacing={2}>
              <Card variant="outlined" sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                  <Stack spacing={2}>
                    <Typography variant="h6" fontWeight={900}>راه‌های ارتباطی</Typography>
                    {hasChannels ? (
                      <>
                        {config.phones.map((phone) => (
                          <Stack direction="row" spacing={1} alignItems="center" key={`${phone.label}-${phone.number}`}>
                            <PhoneRounded color="primary" fontSize="small" />
                            <MuiLink href={`tel:${phone.number.replace(/\s+/g, '')}`} underline="hover" dir="ltr">
                              {phone.label}: {phone.number}
                            </MuiLink>
                          </Stack>
                        ))}
                        {config.socials.map((social) => social.platform === 'globalAddress' ? (
                          <Typography variant="body2" color="text.secondary" key={`${social.platform}-${social.url}`}>
                            {social.url}
                          </Typography>
                        ) : (
                          <MuiLink component={Link} href={social.url} target="_blank" rel="noopener noreferrer" key={`${social.platform}-${social.url}`}>
                            {socialLabels[social.platform] ?? social.platform}
                          </MuiLink>
                        ))}
                        {config.addresses.map((address) => (
                          <Typography variant="body2" color="text.secondary" key={`${address.label}-${address.address}`}>
                            {address.label ? `${address.label}: ` : ''}{address.address}
                          </Typography>
                        ))}
                      </>
                    ) : (
                      <Alert severity="info">راه‌های ارتباطی هنوز در تنظیمات سایت ثبت نشده است.</Alert>
                    )}
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                  <Stack direction="row" spacing={1.25} alignItems="flex-start">
                    <ScheduleRounded color="primary" />
                    <Box>
                      <Typography fontWeight={800}>پاسخ‌گویی و پیگیری</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.9 }}>
                        {config.support.responseTime || 'پس از ثبت، وضعیت تیکت از حساب کاربری قابل مشاهده است.'}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Grid>
        </Grid>

        {user ? (
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
                  <Typography variant="h6" fontWeight={900}>تیکت‌های من</Typography>
                  {ticketsLoading ? <Chip size="small" label="در حال دریافت…" /> : null}
                </Stack>
                {tickets.length === 0 && !ticketsLoading ? (
                  <Typography color="text.secondary">هنوز تیکتی برای شما ثبت نشده است.</Typography>
                ) : null}
                {tickets.map((ticket) => (
                  <Box key={ticket.id} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
                      <Box>
                        <Typography fontWeight={800}>{ticket.title}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {ticket.ticketNumber} · {formatDate(ticket.createdAt)}
                        </Typography>
                      </Box>
                      <Chip size="small" label={SUPPORT_STATUS_LABELS[ticket.status]} color={ticket.status === 'resolved' || ticket.status === 'closed' ? 'success' : 'default'} />
                    </Stack>
                    {ticket.replies.length > 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        آخرین پاسخ پشتیبانی: {ticket.replies[ticket.replies.length - 1]?.body}
                      </Typography>
                    ) : null}
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        ) : null}
      </Stack>
    </Box>
  );
}
