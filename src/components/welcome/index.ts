"use client"
import dynamic from "next/dynamic";

export const Welcome = dynamic(() => import("./logic")) 