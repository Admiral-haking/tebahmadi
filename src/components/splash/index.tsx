import { Stack } from "@mui/material";
import { FuzzyText, TrueFocus } from "../react-bits";

export default function Splash() {
    return <Stack
        sx={{
            width: '100%',
            p: 4,
            height: '80vh'
        }}
        alignItems="center"
        justifyContent="center"
        gap={4}
    >
        <TrueFocus
            sentence="در حال بارگیری"
            manualMode={false}
            blurAmount={5}
            borderColor="red"
            animationDuration={.3}
            pauseBetweenAnimations={.7}
        />
        <FuzzyText
            children="منتظر بمانید"
            fontSize={18}
        />
    </Stack>
}