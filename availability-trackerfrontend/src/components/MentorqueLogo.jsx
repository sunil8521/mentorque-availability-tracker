const SIZES = {
  sm: { outer: "h-6 w-6", inner: "h-3.5 w-3.5", gap: "gap-2", text: "text-base" },
  md: { outer: "h-8 w-8", inner: "h-5 w-5", gap: "gap-2.5", text: "text-[15px]" },
  lg: { outer: "h-10 w-10", inner: "h-6 w-6", gap: "gap-3", text: "text-xl" },
};

export function MentorqueLogoMark({ size = "md", className = "" }) {
  const s = SIZES[size] ?? SIZES.md;
  return (
    <div
      className={`flex ${s.outer} shrink-0 items-center justify-center rounded-lg bg-white ${className}`}
      aria-hidden
    >
      <div className={`${s.inner} rounded-sm bg-black`} />
    </div>
  );
}

export default function MentorqueBrand({
  size = "md",
  textClassName = "font-bold text-ink-50 tracking-tight",
  className = "",
}) {
  const s = SIZES[size] ?? SIZES.md;
  return (
    <div className={`flex items-center ${s.gap} ${className}`}>
      <MentorqueLogoMark size={size} />
      <span className={`${s.text} ${textClassName}`}>Mentorque</span>
    </div>
  );
}
