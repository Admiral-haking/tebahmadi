"use client";

import ProductCard, { ProductCardProps } from "@/components/product";
import { Box } from "@mui/material";
import useEmblaCarousel from "embla-carousel-react";

type Props = {
  products: ProductCardProps[];
};

export default function DiscountClient({ products }: Props) {
  const [emblaRef] = useEmblaCarousel({ direction: "rtl", loop: true, align: "start" });

  return (
    <Box
      ref={emblaRef}
      sx={{
        overflow: "hidden",
        mt: { xs: 1.5, md: 2 },
        px: { xs: 0.75, sm: 1.25 },
      }}
    >
      <Box
        sx={{
          display: "flex",
          touchAction: "pan-y pinch-zoom",
        }}
      >
        {products.map((item, index) => (
          <Box
            key={item.id}
            sx={{
              width: { xs: "78vw", sm: 240, md: 260 },
              minWidth: { xs: "78vw", sm: 240, md: 260 },
              maxWidth: { xs: 330, sm: 260 },
              p: { xs: 0.75, md: 1 },
            }}
          >
            <ProductCard
              {...item}
              imageSizes="(max-width: 600px) 78vw, (max-width: 900px) 240px, 260px"
              priorityImage={index === 0}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
