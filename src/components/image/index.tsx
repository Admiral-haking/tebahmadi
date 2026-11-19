"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useState } from "react";
import styles from "./image.module.css";

type OptimizedImageProps = ImageProps & {
    containerStyle?: React.CSSProperties;
    fallbackSrc?: ImageProps["src"];
};

export default function OptimizedImage(props: OptimizedImageProps) {
    const {
        containerStyle,
        fallbackSrc,
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

    const [isLoaded, setIsLoaded] = useState(false);
    const [currentSrc, setCurrentSrc] = useState(props.src);

    const hasDimensions = !!(props.width && props.height);
    const aspectRatio = hasDimensions ? Number(props.width) / Number(props.height) : undefined;

    useEffect(() => {
        setCurrentSrc(props.src);
        setIsLoaded(false);
    }, [props.src]);

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
                backgroundColor: "rgba(var(--mui-palette-text-secondaryChannel) / 0.12)",
                borderRadius: 1,
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
                    if (fallbackSrc && currentSrc !== fallbackSrc) {
                        setCurrentSrc(fallbackSrc);
                        setIsLoaded(false);
                    } else {
                        setIsLoaded(true);
                    }
                    onError?.(event);
                }}
                style={{
                    objectFit: props.fill ? "cover" : "contain",
                    opacity: isLoaded ? 1 : 0,
                    transition: "opacity 220ms ease",
                    ...(style || {}),
                }}
            />

            {!isLoaded && (
                <div className={styles.shimmer} />
            )}
        </div>
    );
}
