import ArrowBackIosNewRounded from "@mui/icons-material/ArrowBackIosNewRounded";
import CampaignOutlined from "@mui/icons-material/CampaignOutlined";
import ChatBubbleOutlineRounded from "@mui/icons-material/ChatBubbleOutlineRounded";
import Instagram from "@mui/icons-material/Instagram";
import SendRounded from "@mui/icons-material/SendRounded";
import { Box, Button, Container, Stack, Typography } from "@mui/material";

export interface SiteSocialLink {
  platform?: string | null;
  url?: string | null;
}

export interface VisibleSocialLink {
  platform: string;
  url: string;
  label: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  telegram: "کانال تلگرام",
  instagram: "پیج اینستاگرام",
  baleh: "کانال بله",
  whatsapp: "واتساپ",
  eeta: "ایتا",
  rubika: "روبیکا",
  youtube: "یوتیوب",
  twitter: "توییتر",
  x: "شبکه ایکس",
  facebook: "فیس‌بوک",
  digikala: "فروشگاه دیجی‌کالا",
  torob: "فروشگاه ترب",
};

function isSafeSocialUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function getVisibleSocialLinks(
  socials: readonly SiteSocialLink[] | null | undefined,
): VisibleSocialLink[] {
  const seen = new Set<string>();

  return (socials ?? []).flatMap((social) => {
    const platform = social.platform?.trim().toLowerCase() ?? "";
    const url = social.url?.trim() ?? "";
    const label = PLATFORM_LABELS[platform];

    if (!label || !url || !isSafeSocialUrl(url) || seen.has(platform)) {
      return [];
    }

    seen.add(platform);
    return [{ platform, url, label }];
  });
}

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === "telegram") {
    return <SendRounded fontSize="small" aria-hidden />;
  }
  if (platform === "instagram") {
    return <Instagram fontSize="small" aria-hidden />;
  }
  if (platform === "baleh" || platform === "eeta" || platform === "rubika") {
    return <ChatBubbleOutlineRounded fontSize="small" aria-hidden />;
  }
  return <CampaignOutlined fontSize="small" aria-hidden />;
}

export default function SocialFollowBanner({
  links,
  brandName = "طب احمدی",
}: {
  links?: readonly SiteSocialLink[] | null;
  brandName?: string;
}) {
  const visibleLinks = getVisibleSocialLinks(links);

  if (visibleLinks.length === 0) {
    return null;
  }

  return (
    <Container maxWidth="lg" sx={{ px: { xs: 1.5, sm: 2 }, my: { xs: 2.5, md: 4 } }}>
      <Box
        component="section"
        aria-labelledby="social-follow-banner-title"
        dir="rtl"
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: "center",
          justifyContent: "space-between",
          gap: { xs: 2, md: 4 },
          border: 1,
          borderColor: "divider",
          borderRadius: 2,
          bgcolor: "background.paper",
          px: { xs: 2, sm: 3, md: 4 },
          py: { xs: 2, sm: 2.5 },
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={1.5}
          sx={{ minWidth: 0, width: { xs: "100%", md: "auto" } }}
        >
          <CampaignOutlined sx={{ color: "secondary.main", fontSize: { xs: 34, sm: 42 } }} aria-hidden />
          <Stack spacing={0.35}>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
              برای اطلاع از آخرین تخفیف‌ها و موجودی محصولات
            </Typography>
            <Typography
              id="social-follow-banner-title"
              component="h2"
              sx={{ color: "primary.main", fontSize: { xs: 15, sm: 17 }, fontWeight: 800, lineHeight: 1.6 }}
            >
              {brandName.trim() || "طب احمدی"} را در شبکه‌های اجتماعی دنبال کنید!
            </Typography>
          </Stack>
        </Stack>

        <Stack
          direction="row"
          useFlexGap
          flexWrap="wrap"
          gap={1.25}
          dir="ltr"
          sx={{ width: { xs: "100%", md: "auto" }, justifyContent: { xs: "center", md: "flex-start" } }}
        >
          {visibleLinks.map((social) => (
            <Button
              key={`${social.platform}-${social.url}`}
              component="a"
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={social.label}
              variant="outlined"
              startIcon={<ArrowBackIosNewRounded sx={{ fontSize: "14px !important" }} aria-hidden />}
              endIcon={<PlatformIcon platform={social.platform} />}
              sx={{
                minWidth: { xs: 148, sm: 184 },
                flex: { xs: "1 1 148px", sm: "0 1 auto" },
                borderRadius: 999,
                borderColor: "divider",
                bgcolor: "rgba(243, 242, 229, .72)",
                color: "text.secondary",
                px: { xs: 1.5, sm: 2 },
                py: 0.75,
                fontSize: { xs: 11, sm: 12 },
                whiteSpace: "nowrap",
                "&:hover": { borderColor: "primary.main", bgcolor: "rgba(243, 242, 229, 1)" },
              }}
            >
              {social.label}
            </Button>
          ))}
        </Stack>
      </Box>
    </Container>
  );
}
