import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const pad2 = (value) => String(value).padStart(2, "0");

/** DD/MM/YYYY */
export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** DD/MM/YYYY HH:MM AM/PM */
export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 || 12;
  const period = hours24 >= 12 ? "PM" : "AM";
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(hours12)}:${pad2(date.getMinutes())} ${period}`;
}

