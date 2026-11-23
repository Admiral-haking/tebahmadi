"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Button, Fade, InputBase, InputProps, Stack, SxProps } from "@mui/material";
import { useRouter } from "next/navigation";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { useEffect } from "react";
import z from "zod";

type Props = InputProps & {
    boxSx?: SxProps;
    onSearchUrl?: string;
    alwaysShowSearch?: boolean;
    initialQuery?: string;
    preserveQueryParams?: boolean;
    onSearch?: (str: string) => any

};

export default function SearchBox({ boxSx = {}, onSearchUrl: url, alwaysShowSearch, initialQuery, preserveQueryParams, onSearch, ...props }: Props) {
    const methods = useForm<{ q: string }>({
        resolver: zodResolver(z.object({ q: z.string() })),
        defaultValues: { q: initialQuery ?? "" },
    });

    const router = useRouter();

    const {
        handleSubmit,
        reset,
        control
    } = methods;

    useEffect(() => {
        reset({ q: initialQuery ?? "" });
    }, [initialQuery, reset]);

    const onSubmit = handleSubmit(async ({ q }) => {
        const [onSearchUrl, search] = url?.split("?") || []

        reset({ q: preserveQueryParams ? q : "" });

        if (onSearch) return onSearch(q)

        if (!onSearchUrl) {
            return;
        }
        let targetPath = onSearchUrl;
        let params = new URLSearchParams();
        if (preserveQueryParams) {
            params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
        }
        if (q && q.trim().length > 0) {
            params.set("q", q.trim());
        } else {
            params.delete("q");
        }

        search?.split("&").forEach(x => {
            const [k, v] = x.split("=")
            params.set(k, v)
        })
        const queryString = params.toString();
        if (queryString) {
            targetPath = `${onSearchUrl}?${queryString}`;
        }
        router.push(targetPath, { scroll: true });
    });


    useEffect(() => {
        methods.setValue("q", initialQuery || "")
    }, [initialQuery])

    return <Box
        sx={{
            position: 'relative',
            maxWidth: 400,
            width: '100%',
            minWidth: 0,
            ...boxSx
        }}
    >
        <FormProvider  {...methods}>

            <form onSubmit={onSubmit} noValidate autoComplete="off" style={{ minWidth: 0 }}>

                <Stack
                    direction="row"
                    alignItems="center"
                    gap={2}
                    sx={{
                        p: .5,
                        overflow: 'hidden',
                        width: '100%',
                        minWidth: 0,
                        transition: 'all .2s ease',
                        px: { xs: 1, sm: 2 },
                        gap: { xs: 0.75, sm: 2 },
                        borderRadius: 3,
                        bgcolor: 'background.default'
                    }}
                >
                    <svg style={{ flexShrink: 0 }} xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                        <path fill="currentColor" d="M20.313 11.157a9.157 9.157 0 1 1-18.313 0a9.157 9.157 0 0 1 18.313 0" opacity={0.5}></path>
                        <path fill="currentColor" d="m17.1 18.122l3.666 3.666a.723.723 0 0 0 1.023-1.022L18.122 17.1a9 9 0 0 1-1.022 1.022"></path>
                    </svg>
                    <Controller
                        control={control}
                        name="q"
                        render={({ field }) => <>
                            <InputBase
                                {...props}
                                placeholder="جستجو..."
                                sx={{
                                    p: 1,
                                    minWidth: 0,
                                }}
                                fullWidth
                                value={field.value}
                                onChange={e => field.onChange(e.target.value)}
                            />

                            <Fade in={!!alwaysShowSearch || !!field.value}>
                                <Button size="small" type="submit" sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                                    جستجو
                                </Button>
                            </Fade>
                        </>}
                    />
                </Stack>
            </form>
        </FormProvider>
    </Box>
}
