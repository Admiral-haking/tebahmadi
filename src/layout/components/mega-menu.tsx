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
                        bgcolor: 'background.default',
                        backgroundImage: 'none'
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
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    p: 2
                }}
            >
                <Typography variant="h5">محصولات ما</Typography>

                <IconButton onClick={() => setOpen(false)}>
                    <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                        <path
                            fill="currentColor"
                            d="m6.4 19l-1.4-1.4l5.6-5.6l-5.6-5.6l1.4-1.4l5.6 5.6l5.6-5.6l1.4 1.4l-5.6 5.6l5.6 5.6l-1.4 1.4l-5.6-5.6z"
                        />
                    </svg>
                </IconButton>
            </Stack>
            <DialogContent sx={{ mt: 8 }}>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 3 }}>
                        <List>
                            {
                                roots.map(item => <ListItem key={`${item._id}`}>
                                    <ListItemButton onClick={() => setSelected(`${item._id}`)}>
                                        <ListItemIcon>
                                            <Box sx={{
                                                width: 32,
                                                height: 32,
                                                position: 'relative',
                                                borderRadius: '50%',
                                                overflow: 'hidden'
                                            }}>
                                                <Image
                                                    src={`/api/media/${item.mediaId}`}
                                                    alt={item.name}
                                                    fill
                                                    loading="lazy"
                                                    objectFit="cover"
                                                    fetchPriority="low"
                                                    style={{
                                                        maxHeight: 32,
                                                        maxWidth: 32
                                                    }}
                                                />
                                            </Box>
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={item.name}
                                        />
                                    </ListItemButton>
                                </ListItem>)
                            }
                        </List>
                    </Grid>
                    <Grid size={{ xs: 3 }}>
                        {
                            col1.map(item => <Box key={item.path}>
                                <Button
                                    size="small"
                                    startIcon={<Box sx={{
                                        width: 32,
                                        height: 32,
                                        position: 'relative',
                                        borderRadius: '50%',
                                        overflow: 'hidden'
                                    }}>
                                        <Image
                                            src={`/api/media/${item.mediaId}`}
                                            alt={item.name}
                                            fill
                                            loading="lazy"
                                            objectFit="cover"
                                            fetchPriority="low"
                                            style={{
                                                maxHeight: 32,
                                                maxWidth: 32
                                            }}
                                        />
                                    </Box>}
                                    LinkComponent={Link}
                                    onClick={() => setOpen(false)}
                                    href={`/store/${item.path}`}
                                >
                                    {item.name}
                                </Button>
                                <ul>
                                    {
                                        categories.filter(x => `${x.parentId}` === `${item._id}`).map(x => <li key={x.path}>
                                            <Button size="small" LinkComponent={Link}
                                                onClick={() => setOpen(false)} href={`/store/${x.path}`}>{x.name}</Button>
                                        </li>)
                                    }
                                </ul>
                            </Box>)
                        }
                    </Grid>
                    <Grid size={{ xs: 3 }}>
                        {
                            col2.map(item => <Box key={item.path}>
                                <Button
                                    size="small"
                                    startIcon={<Box sx={{
                                        width: 32,
                                        height: 32,
                                        position: 'relative',
                                        borderRadius: '50%',
                                        overflow: 'hidden'
                                    }}>
                                        <Image
                                            src={`/api/media/${item.mediaId}`}
                                            alt={item.name}
                                            fill
                                            loading="lazy"
                                            objectFit="cover"
                                            fetchPriority="low"
                                            style={{
                                                maxHeight: 32,
                                                maxWidth: 32
                                            }}
                                        />
                                    </Box>}
                                    LinkComponent={Link}
                                    onClick={() => setOpen(false)}
                                    href={`/store/${item.path}`}
                                >
                                    {item.name}
                                </Button>
                                <ul>
                                    {
                                        categories.filter(x => `${x.parentId}` === `${item._id}`).map(x => <li key={x.path}>
                                            <Button size="small" LinkComponent={Link}
                                                onClick={() => setOpen(false)} href={`/store/${x.path}`}>{x.name}</Button>
                                        </li>)
                                    }
                                </ul>
                            </Box>)
                        }
                    </Grid>
                    <Grid size={{ xs: 3 }}>
                        {
                            col3.map(item => <Box key={item.path}>
                                <Button
                                    size="small"
                                    startIcon={<Box sx={{
                                        width: 32,
                                        height: 32,
                                        position: 'relative',
                                        borderRadius: '50%',
                                        overflow: 'hidden'
                                    }}>
                                        <Image
                                            src={`/api/media/${item.mediaId}`}
                                            alt={item.name}
                                            fill
                                            loading="lazy"
                                            objectFit="cover"
                                            fetchPriority="low"
                                            style={{
                                                maxHeight: 32,
                                                maxWidth: 32
                                            }}
                                        />
                                    </Box>}
                                    LinkComponent={Link}
                                    onClick={() => setOpen(false)}
                                    href={`/store/${item.path}`}
                                >
                                    {item.name}
                                </Button>
                                <ul>
                                    {
                                        categories.filter(x => `${x.parentId}` === `${item._id}`).map(x => <li key={x.path}>
                                            <Button size="small" LinkComponent={Link}
                                                onClick={() => setOpen(false)} href={`/store/${x.path}`}>{x.name}</Button>
                                        </li>)
                                    }
                                </ul>
                            </Box>)
                        }
                    </Grid>
                </Grid>
            </DialogContent>
        </Dialog>
    </>
}