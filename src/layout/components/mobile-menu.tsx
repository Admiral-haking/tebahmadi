
import { Avatar, List, ListItem, ListItemAvatar, ListItemButton, ListItemIcon, ListItemText } from "@mui/material";
import Link from "next/link";

export default function MobileMenu({ hotLinks }: { hotLinks: any[] }) {
    return <List>
        {
            mockData.map(item => <ListItem key={item.href}>
                <ListItemButton
                    LinkComponent={Link}
                    href={item.href}
                    aria-label={item.title}
                >
                    <ListItemIcon>
                        {item.icon}
                    </ListItemIcon>
                    <ListItemText
                        primary={item.title}
                    />
                </ListItemButton>
            </ListItem>)
        }
        {
            hotLinks?.map((item: any) => <ListItem key={item.href}>
                <ListItemButton
                    LinkComponent={Link}
                    href={item.href}
                    aria-label={item.title}
                >
                    <ListItemAvatar>
                        <Avatar
                            src={`/api/media/${item.mediaId}`}
                            alt={item.title}
                            sx={{ height: 24, width: 24 }}
                        />
                    </ListItemAvatar>
                    <ListItemText
                        primary={item.title}
                    />
                </ListItemButton>
            </ListItem>)
        }
    </List>
}

const mockData = [
    {
        title: "ویترین",
        icon: <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
            <g fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" d="M22 22H2m0-11l8.126-6.5a3 3 0 0 1 3.748 0L22 11"></path>
                <path strokeLinecap="round" d="M15.5 5.5v-2A.5.5 0 0 1 16 3h2.5a.5.5 0 0 1 .5.5v5" opacity={0.5}></path>
                <path strokeLinecap="round" d="M4 22V9.5M20 22V9.5"></path>
                <path d="M15 22v-5c0-1.414 0-2.121-.44-2.56C14.122 14 13.415 14 12 14s-2.121 0-2.56.44C9 14.878 9 15.585 9 17v5m5-12.5a2 2 0 1 1-4 0a2 2 0 0 1 4 0Z" opacity={0.5}></path>
            </g>
        </svg>,
        href: "/"
    },
    {
        title: "فروشگاه",
        icon: <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
            <path fill="currentColor" d="M14.5 21.991V18.5c0-.935 0-1.402-.201-1.75a1.5 1.5 0 0 0-.549-.549C13.402 16 12.935 16 12 16s-1.402 0-1.75.201a1.5 1.5 0 0 0-.549.549c-.201.348-.201.815-.201 1.75v3.491z"></path>
            <path fill="currentColor" fillRule="evenodd" d="M5.732 12c-.89 0-1.679-.376-2.232-.967V14c0 3.771 0 5.657 1.172 6.828c.943.944 2.348 1.127 4.828 1.163h5c2.48-.036 3.885-.22 4.828-1.163C20.5 19.657 20.5 17.771 20.5 14v-2.966a3.06 3.06 0 0 1-5.275-1.789l-.073-.728a3.167 3.167 0 1 1-6.307.038l-.069.69A3.06 3.06 0 0 1 5.732 12m8.768 6.5v3.491h-5V18.5c0-.935 0-1.402.201-1.75a1.5 1.5 0 0 1 .549-.549C10.598 16 11.065 16 12 16s1.402 0 1.75.201a1.5 1.5 0 0 1 .549.549c.201.348.201.815.201 1.75" clipRule="evenodd" opacity={0.5}></path>
            <path fill="currentColor" d="M9.5 2h5l.652 6.517a3.167 3.167 0 1 1-6.304 0z"></path>
            <path fill="currentColor" d="M3.33 5.351c.178-.89.267-1.335.448-1.696a3 3 0 0 1 1.889-1.548C6.057 2 6.51 2 7.418 2h2.083l-.725 7.245a3.06 3.06 0 1 1-6.044-.904zm17.34 0c-.178-.89-.267-1.335-.448-1.696a3 3 0 0 0-1.888-1.548C17.944 2 17.49 2 16.582 2H14.5l.725 7.245a3.06 3.06 0 1 0 6.043-.904z" opacity={0.7}></path>
        </svg>,
        href: "/store"
    },
    {
        title: "وبلاگ",
        icon: <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
            <path fill="currentColor" fillRule="evenodd" d="M1.25 3A.75.75 0 0 1 2 2.25h20a.75.75 0 0 1 0 1.5H2A.75.75 0 0 1 1.25 3" clipRule="evenodd"></path>
            <path fill="currentColor" d="M4 3.75v9.527c0 1.34 0 2.01.268 2.601s.772 1.032 1.781 1.915l2 1.75c1.883 1.647 2.824 2.47 3.951 2.47s2.069-.823 3.951-2.47l2-1.75c1.008-.883 1.513-1.324 1.78-1.915c.269-.59.269-1.26.269-2.6V3.75z" opacity={0.5}></path>
            <path fill="currentColor" fillRule="evenodd" d="M7.75 14a.75.75 0 0 1 .75-.75h7a.75.75 0 0 1 0 1.5h-7a.75.75 0 0 1-.75-.75m0-5a.75.75 0 0 1 .75-.75h7a.75.75 0 0 1 0 1.5h-7A.75.75 0 0 1 7.75 9" clipRule="evenodd"></path>
        </svg>,
        href: "/blog"
    },
]