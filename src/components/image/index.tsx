"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useState } from "react";
import styles from "./image.module.css";

type OptimizedImageProps = ImageProps & {
    containerStyle?: React.CSSProperties;
    fallbackSrc?: ImageProps["src"];
    transparentBackground?: boolean;
};

function isUsableImageSource(
    source: ImageProps["src"] | null | undefined,
): source is ImageProps["src"] {
    if (!source) {
        return false;
    }

    if (typeof source !== "string") {
        return true;
    }

    const value = source.trim();
    return Boolean(value) && !/(^|[\\/])(?:undefined|null)(?:[/?#]|$)/i.test(value);
}

export default function OptimizedImage(props: OptimizedImageProps) {
    const {
        containerStyle,
        fallbackSrc,
        transparentBackground = false,
        style,
        onLoad,
        onError,
        alt,
        loading,
        decoding,
        priority,
        fetchPriority,
        ...imageProps
    } = props;

    const fallback = isUsableImageSource(fallbackSrc) ? fallbackSrc : "/product-placeholder.svg";
    const safeSource = isUsableImageSource(props.src) ? props.src : fallback;
    const [isLoaded, setIsLoaded] = useState(false);
    const [currentSrc, setCurrentSrc] = useState<ImageProps["src"]>(safeSource);

    const hasDimensions = !!(props.width && props.height);
    const aspectRatio = hasDimensions ? Number(props.width) / Number(props.height) : undefined;

    useEffect(() => {
        setCurrentSrc(safeSource);
        setIsLoaded(false);
    }, [safeSource]);

    const resolvedAlt = typeof alt === "string" ? alt : "";
    const resolvedLoading = priority ? undefined : (loading ?? "lazy");
    const resolvedDecoding = decoding ?? "async";
    const resolvedFetchPriority = fetchPriority ?? (priority ? "high" : "auto");

    return (
        <div
            style={{
                position: "relative",
                overflow: "hidden",
                width: props.fill ? "100%" : (props.width || "100%"),
                height: props.fill ? "100%" : (props.height || "auto"),
                aspectRatio: props.fill ? undefined : aspectRatio,
                backgroundColor: transparentBackground ? "transparent" : "rgba(var(--mui-palette-text-secondaryChannel) / 0.12)",
                borderRadius: transparentBackground ? 0 : 1,
                ...(containerStyle || {}),
            }}
            aria-label={resolvedAlt ? `تصویر ${resolvedAlt}` : "تصویر"}
        >
            <Image
                {...imageProps}
                src={currentSrc}
                alt={resolvedAlt}
                priority={priority}
                loading={resolvedLoading}
                decoding={resolvedDecoding}
                fetchPriority={resolvedFetchPriority}
                onLoad={(event) => {
                    setIsLoaded(true);
                    onLoad?.(event);
                }}
                onError={(event) => {
                    if (currentSrc !== fallback) {
                        setCurrentSrc(fallback);
                        setIsLoaded(false);
                    } else {
                        setIsLoaded(true);
                    }
                    onError?.(event);
                }}
                style={{
                    objectFit: props.fill ? "cover" : "contain",
                    transition: "opacity 220ms ease",
                    ...(style || {}),
                }}
            />

            {!isLoaded && !transparentBackground && (
                <div className={styles.shimmer} />
            )}
        </div>
    );
}
