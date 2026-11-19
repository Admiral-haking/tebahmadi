import * as React from "react";
import {
    Box,
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton,
    InputAdornment,
    CircularProgress,
    Stack,
    Typography,
    Divider,
    Tooltip,
    Accordion,
    AccordionSummary,
    Chip,
    AccordionDetails,
    InputBase,
} from "@mui/material";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { ShinyText } from "@/components/react-bits/shiny";
import { useFormContext } from "react-hook-form";
import { SYSTEM_PRODUCT_TYPE_PROMPT } from "../constants/product-type-prompt";
import { useEasyLLM } from "easy-llm-call/react";
import { toast } from "sonner";
import { MessageBubble } from "../../products/components/llm-text";
import { FuzzyText } from "@/components/react-bits";
import z from "zod";

// -------------------------
// Types
// -------------------------
export type LlmResponse = {
    message: string;
    object?: any; // full product object (minus productTypeId/mediaIds)
};

export type AIProductChatDialogProps = {
    open?: boolean;
    onClose?: () => void;
    title?: string;

    createEmptyAttribute: VoidFunction
    schema: z.ZodObject
    append: (value: any, options?: any) => any,
    remove: (value: number) => any,
    productTypesData: any
};


// -------------------------
// Main Component
// -------------------------
export default function AIProductTypeChatDialog(props: AIProductChatDialogProps) {
    const {
        open,
        onClose,
        title = "افزودن با هوش مصنوعی",
        append,
        createEmptyAttribute,
        remove,
        schema,
        productTypesData
    } = props;


    const { formState: { errors }, setValue, getValues } = useFormContext()
    const { messages, loading, send, errors: { axiosErrors, errors: easyLLMErrors, toolErrors }, llm } = useEasyLLM({
        systemPrompt: SYSTEM_PRODUCT_TYPE_PROMPT.replaceAll("__TYPES__", JSON.stringify(productTypesData)),
        url: '/api/ai/extract',
        retries: 2,
        retryDelay: 5e3,
        onError(err) {
            toast.error(err.message)
        },
        onToolError(name, id, err) {
            toast.error(`Tool Error: tool-name: ${name} Error: ${err?.message}`)
        }
    })



    llm.registerTool("set_value", {
        desc: "the function for setting values to the form. it will return full form object.",
        props: {
            key: {
                type: 'string',
                desc: 'the key of the property you wan to set. example: "name" or "version" or "attributes.[index].key"',
                required: true,
            },
            value: {
                type: 'string',
                desc: 'the value of that field you want to set. for type look at the schema you have in system prompt. if its json just return json string and we will parse it here.',
                required: true
            },
        },
        func: async (args) => {
            try {
                args.value = JSON.parse(args.value)
            }
            catch { }
            setValue(args.key, args.value, { shouldTouch: true });

            return JSON.stringify(getValues());
        },
        type: 'auto'
    })

    llm.registerTool("attributes_append", {
        desc: 'for appending a new row to attributes. it will return full form object.',
        props: {
            attribute: {
                desc: 'attribute object to append to form',
                required: true,
                type: 'object'
            }
        },
        func: ({ attribute }) => {
            if (attribute) {
                append(attribute);
            }
            else
                createEmptyAttribute();
            return JSON.stringify(getValues());
        },
        type: 'auto'
    })
    llm.registerTool("attributes_remove", {
        desc: 'remove a attribute by index. it will return full form object.',
        props: {
            index: {
                desc: 'the index of the attribute you want to remove',
                required: true,
                type: 'number'
            }
        },
        func: ({ index }) => {
            remove(index)
            return JSON.stringify(getValues());
        },
        type: 'auto'
    })


    llm.registerTool("check_errors", {
        desc: 'it validates the current form values with zod',
        func: async () => {
            const result = schema.safeParse(getValues());
            return JSON.stringify(result)
        },
        type: 'auto'
    })

    const [input, setInput] = React.useState("");
    const viewportRef = React.useRef<HTMLDivElement | null>(null);

    // Auto-scroll on message add
    React.useEffect(() => {
        viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight, behavior: "smooth" });
    }, [messages, loading]);

    const handleClose = () => {
        onClose?.();
    };


    const handleSend = async () => {
        send({
            message: {
                role: 'user',
                content: input
            },
            model: 'deepseek-reasoner',
            tool_choice: 'auto',
        })
        setInput("")
    };

    // Enter to send, Shift+Enter for newline
    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    React.useEffect(() => {
        if (!errors) return;
        try {
            if (Object.keys(errors).length === 0) return
            setInput(`خطای اعتبار سنجی:\n${JSON.stringify(errors)}`)
        }
        catch { }
    }, [errors])
    return (
        <Dialog
            open={!!open}
            fullWidth
            maxWidth="md"
            onClose={handleClose}
            slotProps={{
                paper: {
                    sx: {
                        backgroundImage: 'none'
                    }
                }
            }}>
            <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="h6" component="div" sx={{ flex: 1 }}>
                    {title}
                </Typography>
                <Tooltip title="بستن">
                    <IconButton onClick={handleClose} size="small">
                        <CloseRoundedIcon />
                    </IconButton>
                </Tooltip>
            </DialogTitle>

            <DialogContent dividers sx={{ p: 0 }}>
                {/* Messages viewport */}
                <Box ref={viewportRef} sx={{ maxHeight: 480, overflow: "auto", py: 2, px: 1.5 }}>
                    <Stack gap={1}>
                        {messages.filter(x => x.role !== 'system').map((m, i) => (
                            <MessageBubble key={i} role={m.role} text={m.content || ""} tools={m.tool_calls as any} />
                        ))}
                        {loading && (
                            <Box sx={{ display: "flex", justifyContent: "flex-start", px: 1 }}>
                                <ShinyText
                                    text="در حال پردازش..."
                                    speed={1}
                                />
                            </Box>
                        )}
                        {!!(easyLLMErrors.length + axiosErrors.length + toolErrors.length) && <Accordion>
                            <AccordionSummary>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
                                    <Typography variant="caption">
                                        خطاهای سیستم
                                    </Typography>
                                    <Chip color="error" label={easyLLMErrors.length + axiosErrors.length + toolErrors.length} />
                                </Stack>
                            </AccordionSummary>
                            <AccordionDetails>
                                {
                                    easyLLMErrors.map(x => <Typography key={x.timestamp}>
                                        {x.message}
                                    </Typography>)
                                }
                                {
                                    toolErrors.map(x => <Typography key={x.timestamp}>
                                        {x.message}
                                    </Typography>)
                                }
                                {
                                    axiosErrors.map(x => <Typography key={x.timestamp}>
                                        {x.message}
                                    </Typography>)
                                }
                            </AccordionDetails>
                        </Accordion>}
                    </Stack>

                    {
                        messages.length === 1 && <Stack
                            alignItems="center"
                            justifyContent="center"
                            sx={{ width: '100%', height: '80%' }}>
                            <FuzzyText
                                children="Deepseek Assistant"
                                fontSize={32}
                            />
                            <ShinyText
                                text="Waiting for orders master"
                                speed={1}
                            />
                        </Stack>
                    }
                </Box>
                <Divider />

                {/* Composer */}
                <Box sx={{ p: 1.5 }}>
                    <InputBase
                        multiline
                        minRows={2}
                        maxRows={6}
                        fullWidth
                        placeholder="اینجا بنویسید یا جای‌گذاری کنید…"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={onKeyDown}
                        endAdornment={<InputAdornment position="end">
                            <Tooltip title="ارسال">
                                <span>
                                    <IconButton onClick={() => handleSend()} disabled={loading || !input.trim()}>
                                        {loading ? <CircularProgress size={20} /> : <SendRoundedIcon sx={{
                                            rotate: '180deg'
                                        }} />}
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </InputAdornment>}
                    />
                </Box>
            </DialogContent>
        </Dialog>
    );
}
