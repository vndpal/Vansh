import type { Gender } from "@/lib/types";

// Teal for men, violet for women: a coloured border plus a light tint of the same hue.
export const genderStyle: Record<Gender, { border: string; tint: string }> = {
  male: { border: "border-teal-500", tint: "bg-teal-50" },
  female: { border: "border-violet-500", tint: "bg-violet-50" },
};

export const HEAD_HINT = "Head of the family: click to highlight this family";

/** Small tag on a family head's card. */
export function HeadTag({ className = "" }: { className?: string }) {
  return (
    <span className={`rounded bg-teal-600 px-1 text-[10px] font-semibold uppercase leading-4 tracking-wide text-white ${className}`}>
      Head
    </span>
  );
}
