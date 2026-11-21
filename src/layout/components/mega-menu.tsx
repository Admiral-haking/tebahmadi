"use client";
import { CategoryDocument } from "@/catalog/models/Category";
import { Box, Button, Dialog, DialogContent, Grid, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Stack, Typography } from "@mui/material";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";


type Props = {
    categories: CategoryDocument[]
}
export default function MegaMenu({ categories }: Props) {
    const [open, setOpen] = useState(false);

    const roots = categories.filter(x => x.parentId === null)

    const [selected, setSelected] = useState(`${roots[0]?._id || ""}`);

    const subs = categories.filter(x => `${x.parentId}` === selected);

    const middle = Math.ceil(subs.length / 3);

    const col1 = subs.slice(0, middle);
    const col2 = subs.slice(middle, middle * 2)
    const col3 = subs.slice(middle * 2, subs.length)

    return <>
        <Button
            variant="contained"
            color="primary"
            onClick={() => setOpen(true)}
            id="mega-btn-md"
            startIcon={<svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                <path fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={1.5} d="M4 7h3m13 0h-9m9 10h-3M4 17h9m-9-5h16"></path>
            </svg>}>
            محصولات
        </Button>

        <Dialog
            open={open}
            onClose={() => setOpen(false)}
            maxWidth="md"
            fullWidth
            slotProps={{
                paper: {
                    sx: {
                        bgcolor: 'background.paper',
                        borderRadius: 4,
                        overflow: 'hidden',
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
                    p: 2.5,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                }}
            >
                <Typography variant="h6" fontWeight={800}>دسته‌بندی‌های محصولات</Typography>

                <IconButton onClick={() => setOpen(false)} sx={{ width: 40, height: 40 }} aria-label="بستن">
                    <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                        <path
                            fill="currentColor"
                            d="m6.4 19l-1.4-1.4l5.6-5.6l-5.6-5.6l1.4-1.4l5.6 5.6l5.6-5.6l1.4 1.4l-5.6 5.6l5.6 5.6l-1.4 1.4l-5.6-5.6z"
                        />
                    </svg>
                </IconButton>
            </Stack>
            <DialogContent sx={{ p: 2.5 }}>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 3 }}>
                        <List sx={{ p: 0 }}>
                            {
                                roots.map(item => <ListItem key={`${item._id}`} disablePadding sx={{ mb: 0.5 }}>
                                    <ListItemButton
                                        onClick={() => setSelected(`${item._id}`)}
                                        selected={selected === `${item._id}`}
                                        sx={{ borderRadius: 2 }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 42 }}>
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
                                            primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9rem' }}
                                        />
                                    </ListItemButton>
                                </ListItem>)
                            }
                        </List>
                    </Grid>
                    {[col1, col2, col3].map((col, colIndex) => (
                        <Grid key={colIndex} size={{ xs: 3 }}>
                            <Stack spacing={2}>
                                {col.map((item) => {
                                    const childCategories = categories.filter((x) => `${x.parentId}` === `${item._id}`);
                                    return (
                                        <Box key={item.path}>
                                            <Button
                                                size="small"
                                                startIcon={
                                                    <Box sx={{
                                                        width: 28,
                                                        height: 28,
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
                                                LinkComponent={Link}
                                                onClick={() => setOpen(false)}
                                                href={`/store/${item.path}`}
                                                sx={{ fontWeight: 700, justifyContent: 'flex-start', width: '100%' }}
                                            >
                                                {item.name}
                                            </Button>
                                            {childCategories.length > 0 && (
                                                <Stack spacing={0.25} sx={{ pr: 4.5, mt: 0.5 }}>
                                                    {childCategories.map((x) => (
                                                        <Button
                                                            key={x.path}
                                                            size="small"
                                                            LinkComponent={Link}
                                                            onClick={() => setOpen(false)}
                                                            href={`/store/${x.path}`}
                                                            sx={{
                                                                color: 'text.secondary',
                                                                justifyContent: 'flex-start',
                                                                fontSize: '0.825rem',
                                                                py: 0.25,
                                                                '&:hover': { color: 'primary.main' },
                                                            }}
                                                        >
                                                            {x.name}
                                                        </Button>
                                                    ))}
                                                </Stack>
                                            )}
                                        </Box>
                                    );
                                })}
                            </Stack>
                        </Grid>
                    ))}
                </Grid>
            </DialogContent>
        </Dialog>
    </>
}