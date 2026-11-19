'use client' // Error boundaries must be Client Components

import { FuzzyText } from '@/components/react-bits'
import MegaButton from '@/views/home/components/mega-button'
import PopularProducts from '@/views/home/components/popular'
import { Button, Container, Stack, Typography } from '@mui/material'
import Link from 'next/link'
import { useEffect } from 'react'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error)
    }, [error])

    return (
        <>
            <Container maxWidth="lg">
                <Stack
                    alignItems="center"
                    justifyContent="center"
                    sx={{
                        width: '100%',
                        height: '90vh'
                    }}
                    gap={2}
                >
                    <Typography
                        children="500"
                        variant='h1'
                    />
                    <Typography
                        children="خطای داخلی"
                        fontSize={38}
                    />
                    <Typography
                        children="متاسفانه در حال حاضر قادر به ارائه سرویس مورد نظر نیستیم."
                        fontSize={24}
                    />


                    <Stack direction="row" gap={2} alignItems="center" justifyContent="center">
                        <MegaButton />
                        <Button
                            LinkComponent={Link}
                            href="/"
                        >
                            برو به خانه
                        </Button>
                    </Stack>
                </Stack>
            </Container>
        </>
    )
}