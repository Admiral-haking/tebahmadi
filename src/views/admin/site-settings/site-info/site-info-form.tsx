'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Field, Form, RHFSwitch, RHFTextField } from '@/components/hook-form';
import { useSiteInfo } from '../hooks';
import { useAuth } from '@/auth/auth-context';
import { userHasPermission } from '@/auth/permissions';
import AddressesField from './components/addresses-field';
import PhonesField from './components/phones-field';
import SocialsField from './components/socials-field';
import HotLinksField from './components/hot-links-field';
import LogoField from './components/logo-field';
import { SITE_PAGE_KEYS, SITE_PAGE_LABELS, sitePageContentSchema } from '@/settings/site-pages';

const addressSchema = z.object({
  label: z.string().trim().max(100).optional(),
  address: z.string().trim().min(1, 'آدرس را وارد کنید'),
});

const phoneSchema = z.object({
  label: z.string().trim().max(100).optional(),
  number: z.string().trim().min(3, 'شماره تلفن معتبر نیست'),
});

const socialSchema = z.object({
  platform: z.string().trim().min(1, 'نام شبکه اجتماعی را وارد کنید'),
  url: z.string().trim(),
});

const supportSchema = z.object({
  title: z.string().trim().max(160).optional().or(z.literal('')),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  hours: z.string().trim().max(160).optional().or(z.literal('')),
  responseTime: z.string().trim().max(160).optional().or(z.literal('')),
  ticketEnabled: z.boolean(),
});

const contentPagesSchema = z.object({
  about: sitePageContentSchema,
  terms: sitePageContentSchema,
  privacy: sitePageContentSchema,
});

const imageIdSchema = z
  .union([z.string(), z.null()])
  .transform((value) => (value ?? '').trim())
  .pipe(z.string().min(1, 'تصویر را انتخاب کنید'));

const hotLinkSchema = z.object({
  title: z.string().trim().min(1, 'عنوان لینک را وارد کنید'),
  href: z.string().trim(),
  imageId: imageIdSchema,
});

const formSchema = z.object({
  appName: z.string().trim().min(1, 'نام سایت الزامی است'),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  bio: z.string().trim().max(800).optional().or(z.literal('')),
  blogTitle: z.string().trim().max(160).optional().or(z.literal('')),
  blogSubtitle: z.string().trim().max(400).optional().or(z.literal('')),
  videoBackground: z.string().trim().max(500).optional().or(z.literal('')),
  addresses: z.array(addressSchema),
  phones: z.array(phoneSchema),
  socials: z.array(socialSchema),
  contentPages: contentPagesSchema,
  support: supportSchema,
  hotLinks: z.array(hotLinkSchema),
  logo: z.union([logoSchema(), z.null()]),
  enamad: z.string().optional(),
  zarinLink: z.string().optional(),
  enamadLink: z.string().optional(),
});

export type SiteInfoFormValues = z.infer<typeof formSchema>;

const EMPTY_VALUES: SiteInfoFormValues = {
  appName: '',
  description: '',
  bio: '',
  blogTitle: '',
  blogSubtitle: '',
  addresses: [],
  phones: [],
  socials: [],
  contentPages: {
    about: { title: '', description: '', content: '' },
    terms: { title: '', description: '', content: '' },
    privacy: { title: '', description: '', content: '' },
  },
  support: {
    title: '',
    description: '',
    hours: '',
    responseTime: '',
    ticketEnabled: true,
  },
  hotLinks: [],
  logo: null,
  videoBackground: '',
  enamad: '',
  enamadLink: '',
  zarinLink: '',
};

function logoSchema() {
  return z.object({
    originalId: z.string().trim().min(1),
    mobileId: z.string().trim().min(1),
    thumbId: z.string().trim().min(1),
    groupId: z.string().trim().min(1),
  });
}

function toFormValues(data: ReturnType<typeof useSiteInfo>['data']): SiteInfoFormValues {
  if (!data) {
    return EMPTY_VALUES;
  }

  const customData = (data.customData ?? {}) as Record<string, unknown>;
  const rawHotLinks = customData['hotLinks'];
  const hotLinksRaw = Array.isArray(rawHotLinks) ? (rawHotLinks as unknown[]) : [];
  const hotLinks = hotLinksRaw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      title: typeof item.title === 'string' ? item.title : '',
      href: typeof item.href === 'string' ? item.href : '',
      imageId: typeof item.imageId === 'string' ? item.imageId : '',
    }));

  const blogRaw = customData['blog'];
  let blogTitle = '';
  let blogSubtitle = '';
  if (blogRaw && typeof blogRaw === 'object') {
    const blogData = blogRaw as Record<string, unknown>;
    blogTitle = typeof blogData['title'] === 'string' ? (blogData['title'] as string) : '';
    blogSubtitle = typeof blogData['subtitle'] === 'string' ? (blogData['subtitle'] as string) : '';
  }
  const videoBackground =
    typeof customData['videoBackground'] === 'string' ? (customData['videoBackground'] as string) : '';

  return {
    appName: data.appName ?? '',
    description: data.description ?? '',
    bio: data.bio ?? '',
    blogTitle,
    blogSubtitle,
    addresses: data.addresses?.map((item) => ({ label: item.label ?? '', address: item.address })) ?? [],
    phones: data.phones?.map((item) => ({ label: item.label ?? '', number: item.number })) ?? [],
    socials: data.socials?.map((item) => ({ platform: item.platform, url: item.url })) ?? [],
    contentPages: {
      about: {
        title: data.contentPages?.about?.title ?? '',
        description: data.contentPages?.about?.description ?? '',
        content: data.contentPages?.about?.content ?? '',
      },
      terms: {
        title: data.contentPages?.terms?.title ?? '',
        description: data.contentPages?.terms?.description ?? '',
        content: data.contentPages?.terms?.content ?? '',
      },
      privacy: {
        title: data.contentPages?.privacy?.title ?? '',
        description: data.contentPages?.privacy?.description ?? '',
        content: data.contentPages?.privacy?.content ?? '',
      },
    },
    support: {
      title: data.support?.title ?? '',
      description: data.support?.description ?? '',
      hours: data.support?.hours ?? '',
      responseTime: data.support?.responseTime ?? '',
      ticketEnabled: data.support?.ticketEnabled !== false,
    },
    hotLinks,
    logo: data.logo
      ? {
        originalId: String(data.logo.originalId),
        mobileId: data.logo.mobileId ? String(data.logo.mobileId) : String(data.logo.originalId),
        thumbId: data.logo.thumbId ? String(data.logo.thumbId) : String(data.logo.originalId),
        groupId: String(data.logo.groupId),
      }
      : null,
    videoBackground,
    enamad: customData["enamad"] as string,
    zarinLink: customData["zarinLink"] as string,
    enamadLink: customData["enamadLink"] as string
  };
}

function buildPayload(values: SiteInfoFormValues, previousCustomData: Record<string, unknown> | null | undefined) {
  const payload: Record<string, unknown> = {
    appName: values.appName.trim(),
  };

  if (values.description?.trim()) {
    payload.description = values.description.trim();
  } else {
    payload.description = undefined;
  }

  if (values.bio?.trim()) {
    payload.bio = values.bio.trim();
  } else {
    payload.bio = undefined;
  }

  const addresses = values.addresses
    .map((item) => ({
      label: item.label?.trim() ? item.label.trim() : undefined,
      address: item.address.trim(),
    }))
    .filter((item) => item.address.length > 0);

  payload.addresses = addresses;

  const phones = values.phones
    .map((item) => ({
      label: item.label?.trim() ? item.label.trim() : undefined,
      number: item.number.trim(),
    }))
    .filter((item) => item.number.length > 0);

  payload.phones = phones;

  const socials = values.socials
    .map((item) => ({
      platform: item.platform.trim(),
      url: item.url.trim(),
    }))
    .filter((item) => item.platform.length > 0 && item.url.length > 0);

  payload.socials = socials;

  const normalizeContentPage = (page: SiteInfoFormValues['contentPages']['about']) => ({
    title: page.title?.trim() ?? '',
    description: page.description?.trim() ?? '',
    content: page.content?.trim() ?? '',
  });

  payload.contentPages = {
    about: normalizeContentPage(values.contentPages.about),
    terms: normalizeContentPage(values.contentPages.terms),
    privacy: normalizeContentPage(values.contentPages.privacy),
  };

  payload.support = {
    ...(values.support.title?.trim() ? { title: values.support.title.trim() } : {}),
    ...(values.support.description?.trim() ? { description: values.support.description.trim() } : {}),
    ...(values.support.hours?.trim() ? { hours: values.support.hours.trim() } : {}),
    ...(values.support.responseTime?.trim() ? { responseTime: values.support.responseTime.trim() } : {}),
    ticketEnabled: values.support.ticketEnabled,
  };

  const processedHotLinks = values.hotLinks.map((item) => ({
    title: item.title.trim(),
    href: item.href.trim(),
    imageId: item.imageId.trim(),
  }));

  const baseCustomData = { ...(previousCustomData ?? {}) };

  const blogTitle = typeof values.blogTitle === 'string' ? values.blogTitle.trim() : '';
  const blogSubtitle = typeof values.blogSubtitle === 'string' ? values.blogSubtitle.trim() : '';

  if (blogTitle || blogSubtitle) {
    baseCustomData['blog'] = {
      ...(blogTitle ? { title: blogTitle } : {}),
      ...(blogSubtitle ? { subtitle: blogSubtitle } : {}),
    };
  } else {
    delete baseCustomData['blog'];
  }

  if (processedHotLinks.length) {
    baseCustomData['hotLinks'] = processedHotLinks;
  } else {
    delete baseCustomData['hotLinks'];
  }

  const videoBackground = typeof values.videoBackground === 'string' ? values.videoBackground.trim() : '';
  if (videoBackground) {
    baseCustomData.videoBackground = videoBackground;
  } else {
    delete baseCustomData.videoBackground;
  }

  if (values.zarinLink) {
    baseCustomData.zarinLink = values.zarinLink
  }
  if (values.enamad) {
    baseCustomData.enamad = values.enamad
  }
  if (values.enamadLink) {
    baseCustomData.enamadLink = values.enamadLink
  }

  if (Object.keys(baseCustomData).length > 0) {
    payload.customData = baseCustomData;
  } else {
    payload.customData = undefined;
  }

  if (values.logo === null) {
    payload.logo = null;
  } else if (values.logo) {
    payload.logo = values.logo;
  } else {
    payload.logo = undefined;
  }

  return payload;
}

export default function SiteInfoForm() {
  const { data, loading, error, refresh } = useSiteInfo();
  const { user } = useAuth();
  const canEdit = userHasPermission(user, 'users:write');
  const hasDataLoadedRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const initialCustomData = useMemo(() => data?.customData ?? {}, [data]);

  const methods = useForm<any>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY_VALUES,
    mode: 'onBlur',
  });

  const initialValues = useMemo(() => toFormValues(data), [data]);

  useEffect(() => {
    if (!loading) {
      methods.reset(initialValues);
      hasDataLoadedRef.current = true;
    }
  }, [initialValues, loading, methods]);

  const handleSubmit = methods.handleSubmit(async (values) => {
    if (!canEdit) {
      toast.warning('شما مجوز ویرایش این بخش را ندارید.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/settings/site-info', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(values, initialCustomData)),
      });

      if (!response.ok) {
        const message = (await response.text().catch(() => '')) || response.statusText;
        throw new Error(message || 'خطا در ذخیره اطلاعات');
      }

      toast.success('تغییرات با موفقیت ذخیره شد.');
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ذخیره اطلاعات با خطا مواجه شد');
    } finally {
      setSaving(false);
    }
  });

  const handleReset = () => {
    methods.reset(initialValues);
  };

  if (loading && !hasDataLoadedRef.current) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="center" minHeight={240}>
            <CircularProgress size={28} />
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined">
      <CardHeader
        title="مشخصات عمومی"
        subheader="اطلاعات تماس و برند را در این بخش مدیریت کنید."
      />
      <Divider />
      <CardContent>
        <Stack spacing={3}>
          {error ? (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={() => refresh()}>
                  تلاش مجدد
                </Button>
              }
            >
              {error}
            </Alert>
          ) : null}

          {!canEdit ? (
            <Alert severity="info">
              سطح دسترسی شما فقط برای مشاهده است. برای اعمال تغییرات با مدیر سیستم هماهنگ شوید.
            </Alert>
          ) : null}

          <Form methods={methods as any} onSubmit={handleSubmit}>
            <Stack spacing={3}>
              <LogoField disabled={saving || !canEdit} />

              <Stack spacing={2}>
                <RHFTextField name="appName" label="نام سایت" disabled={saving || !canEdit} />
                <RHFTextField
                  name="description"
                  label="توضیحات کوتاه"
                  multiline
                  minRows={2}
                  disabled={saving || !canEdit}
                />
                <RHFTextField
                  name="bio"
                  label="متن معرفی"
                  multiline
                  minRows={3}
                  disabled={saving || !canEdit}
                />
                <RHFTextField
                  name="enamad"
                  label="کد اعتبار سنجی اینماد"
                  disabled={saving || !canEdit}
                />
                <RHFTextField
                  name="enamadLink"
                  label="لینک اینماد"
                  disabled={saving || !canEdit}
                />
                <RHFTextField
                  name="zarinLink"
                  label="زرین پال لینک"
                  disabled={saving || !canEdit}
                />
              </Stack>

              <Stack spacing={1.5}>
                <Typography variant="subtitle1" fontWeight={700}>
                  تنظیمات صفحه وبلاگ
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  عنوان و زیرعنوان نمایش داده‌شده در بالای صفحه وبلاگ را در این بخش تنظیم کنید.
                </Typography>
                <RHFTextField
                  name="blogTitle"
                  label="عنوان وبلاگ"
                  placeholder="دانش طبیعت برای انتخابی آگاهانه"
                  disabled={saving || !canEdit}
                />
                <RHFTextField
                  name="blogSubtitle"
                  label="زیرعنوان وبلاگ"
                  multiline
                  minRows={2}
                  placeholder="مطالب کاربردی درباره گیاهان دارویی، فرآورده‌های طبیعی و سبک زندگی سالم را بخوانید."
                  helperText="در صورت خالی بودن، متن پیش‌فرض نمایش داده می‌شود."
                  disabled={saving || !canEdit}
                />
              </Stack>

              <Stack spacing={2}>
                <Typography variant="h6" fontWeight={600}>
                  محتوای صفحات ثابت سایت
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  متن صفحات «درباره ما»، «شرایط خرید» و «حریم خصوصی» از این بخش ذخیره و در سایت نمایش داده می‌شود. برای قالب‌بندی بهتر از ویرایشگر غنی هر صفحه استفاده کنید.
                </Typography>
                {SITE_PAGE_KEYS.map((pageKey) => (
                  <Stack key={pageKey} spacing={1.5} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>{SITE_PAGE_LABELS[pageKey]}</Typography>
                    <RHFTextField
                      name={`contentPages.${pageKey}.title`}
                      label="عنوان صفحه"
                      placeholder={SITE_PAGE_LABELS[pageKey]}
                      disabled={saving || !canEdit}
                    />
                    <RHFTextField
                      name={`contentPages.${pageKey}.description`}
                      label="توضیح کوتاه و SEO"
                      placeholder="توضیح کوتاه صفحه برای موتورهای جست‌وجو"
                      disabled={saving || !canEdit}
                    />
                    <Field.Editor
                      name={`contentPages.${pageKey}.content`}
                      label="محتوای صفحه"
                      placeholder="محتوای این صفحه را وارد کنید"
                      minHeight={240}
                      helperText="عنوان‌ها، فهرست‌ها، لینک‌ها و متن صفحه را با ویرایشگر وارد کنید."
                      disabled={saving || !canEdit}
                    />
                  </Stack>
                ))}
              </Stack>

              <AddressesField disabled={saving || !canEdit} />
              <PhonesField disabled={saving || !canEdit} />
              <SocialsField disabled={saving || !canEdit} />
              <Stack spacing={1.5}>
                <Typography variant="h6" fontWeight={600}>
                  تنظیمات پشتیبانی و پاسخ‌گویی
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  متن‌ها و زمان پاسخ‌گویی صفحه تماس از این بخش خوانده می‌شود. شماره‌ها و لینک‌های ارتباطی را فقط در بخش‌های بالا وارد کنید؛ هیچ شماره‌ای در کد سایت ذخیره نشده است.
                </Typography>
                <RHFTextField
                  name="support.title"
                  label="عنوان بخش پشتیبانی"
                  placeholder="تماس با ما"
                  disabled={saving || !canEdit}
                />
                <RHFTextField
                  name="support.description"
                  label="توضیح کوتاه پشتیبانی"
                  multiline
                  minRows={2}
                  placeholder="اگر پرسشی دارید، درخواست خود را ثبت کنید تا پیگیری شود."
                  disabled={saving || !canEdit}
                />
                <RHFTextField
                  name="support.hours"
                  label="ساعات پاسخ‌گویی"
                  placeholder="شنبه تا پنج‌شنبه، ۹ تا ۱۷"
                  disabled={saving || !canEdit}
                />
                <RHFTextField
                  name="support.responseTime"
                  label="زمان تقریبی پاسخ"
                  placeholder="پاسخ‌گویی در روزهای کاری انجام می‌شود."
                  disabled={saving || !canEdit}
                />
                <RHFSwitch
                  name="support.ticketEnabled"
                  label="ثبت تیکت پشتیبانی فعال است"
                  disabled={saving || !canEdit}
                />
              </Stack>
              <HotLinksField disabled={saving || !canEdit} />
              <RHFTextField
                name="videoBackground"
                label="ویدئو پس‌زمینه"
                placeholder="https://example.com/background-video.mp4"
                disabled={saving || !canEdit}
              />

              <CardActions sx={{ px: 0 }}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={saving || !canEdit}
                  startIcon={saving ? <CircularProgress size={18} color="inherit" /> : null}
                >
                  ذخیره تغییرات
                </Button>
                <Button variant="text" onClick={handleReset} disabled={saving}>
                  بازنشانی
                </Button>
              </CardActions>
            </Stack>
          </Form>
        </Stack>
      </CardContent>
    </Card>
  );
}
