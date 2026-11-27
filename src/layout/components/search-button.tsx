import { IconButton } from "@mui/material";
import Link from "next/link";
import { BrandIcon } from "@/components/brand-icons";

export default function SearchButton() {
    return <IconButton aria-label="جست‌وجو" LinkComponent={Link} href="/search"><BrandIcon name="search" size={24} /></IconButton>
}
