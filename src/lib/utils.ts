// הקובץ הזה מכיל את הפונקציה cn שמאחדת classNames של Tailwind בצורה נקייה ומונעת התנגשויות.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
