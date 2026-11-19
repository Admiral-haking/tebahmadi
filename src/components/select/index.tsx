"use client";

import { Button, Menu, MenuItem } from "@mui/material";
import { MouseEvent, ReactNode, useEffect, useMemo, useState } from "react";

type Props = {
    defaultValue?: string;
    label: string;
    options: { label: ReactNode; value: string }[];
    value?: string;
    onChange?: (value: string) => void;
};

export default function SelectDropDown({ label, options, defaultValue, value, onChange }: Props) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [internalValue, setInternalValue] = useState<string>(() => {
        if (value !== undefined) return value;
        if (defaultValue !== undefined) return defaultValue;
        return options[0]?.value ?? "";
    });

    useEffect(() => {
        if (value !== undefined) {
            setInternalValue(value);
        }
    }, [value]);

    useEffect(() => {
        if (value === undefined && defaultValue !== undefined) {
            setInternalValue(defaultValue);
        }
    }, [defaultValue, value]);

    const open = Boolean(anchorEl);
    const handleClick = (event: MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleSelect = (selectedValue: string) => {
        if (value === undefined) {
            setInternalValue(selectedValue);
        }
        onChange?.(selectedValue);
        setAnchorEl(null);
    };

    const selectedLabel = useMemo(() => {
        const lookupValue = value ?? internalValue;
        return options.find((option) => option.value === lookupValue)?.label ?? label;
    }, [options, value, internalValue, label]);

    const currentValue = value ?? internalValue;

    return (
        <>
            <Button
                aria-haspopup="true"
                aria-expanded={open ? "true" : undefined}
                onClick={handleClick}
                startIcon={
                    open ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                            <g fill="none" fillRule="evenodd">
                                <path d="M24 0v24H0V0zM12.594 23.258l-.012.002l-.071.035l-.02.004l-.014-.004l-.071-.036q-.016-.004-.024.006l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.016-.018m.264-.113l-.014.002l-.184.093l-.01.01l-.003.011l.018.43l.005.012l.008.008l.201.092q.019.005.029-.008l.004-.014l-.034-.614q-.005-.018-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.003-.011l.018-.43l-.003-.012l-.01-.01z"></path>
                                <path fill="currentColor" d="M12 5a1 1 0 0 1 .707.293l5 5a1 1 0 0 1-1.414 1.414L12 7.414l-4.293 4.293a1 1 0 0 1-1.414-1.414l5-5A1 1 0 0 1 12 5m0 6a1 1 0 0 1 .707.293l5 5a1 1 0 0 1-1.414 1.414L12 13.414l-4.293 4.293a1 1 0 0 1-1.414-1.414l5-5A1 1 0 0 1 12 11"></path>
                            </g>
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                            <g fill="none" fillRule="evenodd">
                                <path d="M24 0v24H0V0zM12.594 23.258l-.012.002l-.071.035l-.02.004l-.014-.004l-.071-.036q-.016-.004-.024.006l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.016-.018m.264-.113l-.014.002l-.184.093l-.01.01l-.003.011l.018.43l.005.012l.008.008l.201.092q.019.005.029-.008l.004-.014l-.034-.614q-.005-.018-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.003-.011l.018-.43l-.003-.012l-.01-.01z"></path>
                                <path fill="currentColor" d="M6.293 6.293a1 1 0 0 1 1.414 0L12 10.586l4.293-4.293a1 1 0 1 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 0 1 0-1.414m0 6a1 1 0 0 1 1.414 0L12 16.586l4.293-4.293a1 1 0 0 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 0 1 0-1.414"></path>
                            </g>
                        </svg>
                    )
                }
            >
                {selectedLabel}
            </Button>
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: "top",
                    horizontal: "left",
                }}
                transformOrigin={{
                    vertical: "top",
                    horizontal: "left",
                }}
            >
                {options.map((option) => (
                    <MenuItem
                        key={option.value}
                        selected={option.value === currentValue}
                        onClick={() => handleSelect(option.value)}
                    >
                        {option.label}
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
}
