import Image, { type ImageProps } from "next/image";

type RemoteImageProps = Omit<ImageProps, "width" | "height"> & {
  width?: number;
  height?: number;
};

/** Handles database-provided HTTPS images without requiring a fixed remote host allow-list. */
export function RemoteImage({ width = 1200, height = 800, loading = "lazy", alt = "", ...props }: RemoteImageProps) {
  return <Image {...props} width={width} height={height} loading={loading} alt={alt} unoptimized />;
}
