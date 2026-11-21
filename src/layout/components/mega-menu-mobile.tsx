"use client";
import { CategoryDocument } from "@/catalog/models/Category";
import { Box, Button, Dialog, DialogContent, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Stack, Typography } from "@mui/material";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type Props = {
    categories: CategoryDocument[]
}
export default function MegaMenuMobile({ categories }: Props) {
    const [open, setOpen] = useState(false);

    const roots = categories.filter(x => x.parentId === null)

    const [selected, setSelected] = useState("");

    const subs = categories.filter(x => `${x.parentId}` === selected);

    return <>
        <IconButton
            onClick={() => setOpen(true)}
            id="mega-btn-xs"
            aria-label="منوی محصولات"
        >
            <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                <path fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={1.5} d="M4 7h3m13 0h-9m9 10h-3M4 17h9m-9-5h16"></path>
            </svg>
        </IconButton>

        <Dialog
            open={open}
            onClose={() => setOpen(false)}
            fullScreen
            slotProps={{
                paper: {
                    sx: {
                        bgcolor: 'background.default',
                        backgroundImage: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                    }
                }
            }}
        >
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={2}
                sx={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                    pt: 'calc(12px + env(safe-area-inset-top, 0px))',
                    px: 2,
                    pb: 1.5,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                }}
            >
                <Typography variant="h6" fontWeight={800}>دسته‌بندی‌ها</Typography>

                <IconButton onClick={() => setOpen(false)} sx={{ width: 40, height: 40 }} aria-label="بستن منو">
                    <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                        <path
                            fill="currentColor"
                            d="m6.4 19l-1.4-1.4l5.6-5.6l-5.6-5.6l1.4-1.4l5.6 5.6l5.6-5.6l1.4 1.4l-5.6 5.6l5.6 5.6l-1.4 1.4l-5.6-5.6z"
                        />
                    </svg>
                </IconButton>
            </Stack>

            <DialogContent sx={{ p: 2, pb: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
                <Stack
                    direction="row"
                    gap={1}
                    sx={{ mb: 2 }}
                >
                    <Button onClick={() => setOpen(false)} LinkComponent={Link} href="/" startIcon={homeIcon} variant="outlined" size="small" sx={{ borderRadius: 99, flex: 1 }}>
                        ویترین
                    </Button>

                    <Button onClick={() => setOpen(false)} LinkComponent={Link} href="/store" startIcon={storeIcon} variant="outlined" size="small" sx={{ borderRadius: 99, flex: 1 }}>
                        فروشگاه
                    </Button>

                    <Button onClick={() => setOpen(false)} LinkComponent={Link} href="/blog" startIcon={blogIcon} variant="outlined" size="small" sx={{ borderRadius: 99, flex: 1 }}>
                        بلاگ
                    </Button>
                </Stack>

                {
                    !selected ? (
                        <List sx={{ p: 0 }}>
                            {roots.map(item => (
                                <ListItem key={`${item._id}`} disablePadding sx={{ mb: 0.5 }}>
                                    <ListItemButton
                                        onClick={() => setSelected(`${item._id}`)}
                                        sx={{ borderRadius: 2.5, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 44 }}>
                                            <Box sx={{
                                                width: 32,
                                                height: 32,
                                                position: 'relative',
                                                borderRadius: '50%',
                                                overflow: 'hidden',
                                                border: '1px solid',
                                                borderColor: 'divider',
                                                flexShrink: 0,
                                            }}>
                                                <Image
                                                    src={item.mediaId ? `/api/media/${item.mediaId}` : '/category.png'}
                                                    alt={item.name}
                                                    fill
                                                    loading="lazy"
                                                    style={{ objectFit: 'contain', padding: '15%' }}
                                                />
                                            </Box>
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={item.name}
                                            primaryTypographyProps={{ fontWeight: 600, fontSize: '0.925rem' }}
                                        />
                                        <ChevronLeftRoundedIcon fontSize="small" color="action" />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </List>
                    ) : (
                        <Box sx={{ mt: 1 }}>
                            <Button
                                startIcon={<ChevronRightRoundedIcon />}
                                onClick={() => setSelected("")}
                                sx={{ mb: 2, fontWeight: 700 }}
                            >
                                بازگشت به دسته‌بندی‌های اصلی
                            </Button>
                            <Stack spacing={1.5}>
                                {subs.map(item => {
                                    const childCategories = categories.filter(x => `${x.parentId}` === `${item._id}`);
                                    return (
                                        <Box
                                            key={item.path}
                                            sx={{
                                                p: 1.5,
                                                borderRadius: 2.5,
                                                border: '1px solid',
                                                borderColor: 'divider',
                                                bgcolor: 'background.paper',
                                            }}
                                        >
                                            <Button
                                                size="medium"
                                                startIcon={
                                                    <Box sx={{
                                                        width: 30,
                                                        height: 30,
                                                        position: 'relative',
                                                        borderRadius: '50%',
                                                        overflow: 'hidden',
                                                        border: '1px solid',
                                                        borderColor: 'divider',
                                                        flexShrink: 0,
                                                    }}>
                                                        <Image
                                                            src={item.mediaId ? `/api/media/${item.mediaId}` : '/category.png'}
                                                            alt={item.name}
                                                            fill
                                                            loading="lazy"
                                                            style={{ objectFit: 'contain', padding: '15%' }}
                                                        />
                                                    </Box>
                                                }
                                                onClick={() => setOpen(false)}
                                                LinkComponent={Link}
                                                href={`/store/${item.path}`}
                                                sx={{ fontWeight: 700, width: '100%', justifyContent: 'flex-start' }}
                                            >
                                                {item.name}
                                            </Button>
                                            {childCategories.length > 0 && (
                                                <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1, pr: 4 }}>
                                                    {childCategories.map(x => (
                                                        <Button
                                                            key={x.path}
                                                            size="small"
                                                            variant="text"
                                                            onClick={() => setOpen(false)}
                                                            LinkComponent={Link}
                                                            href={`/store/${x.path}`}
                                                            sx={{ color: 'text.secondary', fontSize: '0.8rem' }}
                                                        >
                                                            • {x.name}
                                                        </Button>
                                                    ))}
                                                </Stack>
                                            )}
                                        </Box>
                                    );
                                })}
                            </Stack>
                        </Box>
                    )
                }
            </DialogContent>
        </Dialog>
    </>
}



export const homeIcon = <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24">
    <defs>
        <path id="SVG1WEi9bFG" d="M10.75 9.5a1.25 1.25 0 1 1 2.5 0a1.25 1.25 0 0 1-2.5 0"></path>
    </defs>
    <path fill="currentColor" fillRule="evenodd" d="m21.532 11.586l-.782-.626v10.29H22a.75.75 0 0 1 0 1.5H2a.75.75 0 1 1 0-1.5h1.25V10.96l-.781.626a.75.75 0 1 1-.937-1.172l8.125-6.5a3.75 3.75 0 0 1 4.686 0l8.125 6.5a.75.75 0 1 1-.936 1.172M12 6.75a2.75 2.75 0 1 0 0 5.5a2.75 2.75 0 0 0 0-5.5m1.746 6.562c-.459-.062-1.032-.062-1.697-.062h-.098c-.665 0-1.238 0-1.697.062c-.491.066-.963.215-1.345.597s-.531.854-.597 1.345c-.062.459-.062 1.032-.062 1.697v4.299h7.5v-4.423c0-.612-.004-1.143-.062-1.573c-.066-.491-.215-.963-.597-1.345s-.853-.531-1.345-.597" clipRule="evenodd"></path>
    <g fill="currentColor" fillRule="evenodd" clipRule="evenodd" opacity={0.5}>
        <use href="#SVG1WEi9bFG"></use>
        <use href="#SVG1WEi9bFG"></use>
    </g>
    <path fill="currentColor" d="M12.05 13.25c.664 0 1.237 0 1.696.062c.492.066.963.215 1.345.597s.531.853.597 1.345c.058.43.062.96.062 1.573v4.423h-7.5v-4.3c0-.664 0-1.237.062-1.696c.066-.492.215-.963.597-1.345s.854-.531 1.345-.597c.459-.062 1.032-.062 1.697-.062zM16 3h2.5a.5.5 0 0 1 .5.5v4.14l-3.5-2.8V3.5A.5.5 0 0 1 16 3" opacity={0.5}></path>
</svg>;

export const storeIcon = <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24">
    <path fill="currentColor" d="M14.5 21.991V18.5c0-.935 0-1.402-.201-1.75a1.5 1.5 0 0 0-.549-.549C13.402 16 12.935 16 12 16s-1.402 0-1.75.201a1.5 1.5 0 0 0-.549.549c-.201.348-.201.815-.201 1.75v3.491z"></path>
    <path fill="currentColor" fillRule="evenodd" d="M5.732 12c-.89 0-1.679-.376-2.232-.967V14c0 3.771 0 5.657 1.172 6.828c.943.944 2.348 1.127 4.828 1.163h5c2.48-.036 3.885-.22 4.828-1.163C20.5 19.657 20.5 17.771 20.5 14v-2.966a3.06 3.06 0 0 1-5.275-1.789l-.073-.728a3.167 3.167 0 1 1-6.307.038l-.069.69A3.06 3.06 0 0 1 5.732 12m8.768 6.5v3.491h-5V18.5c0-.935 0-1.402.201-1.75a1.5 1.5 0 0 1 .549-.549C10.598 16 11.065 16 12 16s1.402 0 1.75.201a1.5 1.5 0 0 1 .549.549c.201.348.201.815.201 1.75" clipRule="evenodd" opacity={0.5}></path>
    <path fill="currentColor" d="M9.5 2h5l.652 6.517a3.167 3.167 0 1 1-6.304 0z"></path>
    <path fill="currentColor" d="M3.33 5.351c.178-.89.267-1.335.448-1.696a3 3 0 0 1 1.889-1.548C6.057 2 6.51 2 7.418 2h2.083l-.725 7.245a3.06 3.06 0 1 1-6.044-.904zm17.34 0c-.178-.89-.267-1.335-.448-1.696a3 3 0 0 0-1.888-1.548C17.944 2 17.49 2 16.582 2H14.5l.725 7.245a3.06 3.06 0 1 0 6.043-.904z" opacity={0.7}></path>
</svg>;

export const blogIcon = <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24">
    <path fill="currentColor" fillRule="evenodd" d="M5.879 2.879C5 3.757 5 5.172 5 8v8c0 2.828 0 4.243.879 5.121C6.757 22 8.172 22 11 22h2c2.828 0 4.243 0 5.121-.879C19 20.243 19 18.828 19 16V8c0-2.828 0-4.243-.879-5.121C17.243 2 15.828 2 13 2h-2c-2.828 0-4.243 0-5.121.879M8.25 17a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 0 1.5H9a.75.75 0 0 1-.75-.75M9 12.25a.75.75 0 0 0 0 1.5h6a.75.75 0 0 0 0-1.5zM8.25 9A.75.75 0 0 1 9 8.25h6a.75.75 0 0 1 0 1.5H9A.75.75 0 0 1 8.25 9" clipRule="evenodd"></path>
    <path fill="currentColor" d="M5.235 4.058C5 4.941 5 6.177 5 8v8c0 1.823 0 3.058.235 3.942L5 19.924c-.975-.096-1.631-.313-2.121-.803C2 18.243 2 16.828 2 14v-4c0-2.829 0-4.243.879-5.121c.49-.49 1.146-.707 2.121-.803zm13.53 15.884C19 19.058 19 17.822 19 16V8c0-1.823 0-3.059-.235-3.942l.235.018c.975.096 1.631.313 2.121.803C22 5.757 22 7.17 22 9.999v4c0 2.83 0 4.243-.879 5.122c-.49.49-1.146.707-2.121.803z" opacity={0.5}></path>
</svg>;