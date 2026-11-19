import { Box } from "@mui/material"

type Props = {
    swatches: string[]
}

export default function ColorIcon({ swatches }: Props) {

    const width = swatches.length <= 1 ? 16 : 8;

    return <Box
        sx={{
            borderRadius: .5,
            display: 'flex',
            flexWrap: 'nowrap',
            minHeight: 24,
            overflow: 'hidden',
            borderWidth: .5,
            borderStyle: 'solid',
            borderColor: 'background.default'
        }}>
        {
            swatches.map((x, i) => <Box
                key={x + i}
                sx={{
                    height: '100%',
                    width,
                    backgroundColor: x
                }}
            />)
        }
    </Box>
}