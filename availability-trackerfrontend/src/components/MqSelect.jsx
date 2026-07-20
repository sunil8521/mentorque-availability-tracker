import { useState, useEffect, useRef } from "react";

export default function MqSelect({
  id,
  label,
  value,
  onChange,
  disabled = false,
  placeholder = "Select…",
  options = [],
  menuAlign = "left",
  labelClassName = "",
  className = "relative w-full min-w-0 sm:w-52",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const selected = options.find((opt) => opt.value === value);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const menuPos = menuAlign === "right" ? "right-0 left-auto" : "left-0 right-auto";

  return (
    <div ref={rootRef} className={className}>
      {label && (
        <label htmlFor={id} className={`mq-label ${labelClassName}`.trim()}>
          {label}
        </label>
      )}
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="mq-input flex w-full items-center justify-between gap-2 pr-2 text-left disabled:opacity-40"
      >
        <span className="min-w-0 truncate">{selected ? selected.label : placeholder}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-ink-500 transition-transform ${open ? "rotate-180" : ""}`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-labelledby={id}
          className={`absolute top-full z-50 mt-1 w-full min-w-0 max-h-60 overflow-y-auto mq-scroll rounded-lg border border-white/[0.1] bg-navy-900 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.45)] ${menuPos}`}
        >
          {options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-500">No options</li>
          ) : (
            options.map((opt) => (
              <li key={opt.value} role="option" aria-selected={opt.value === value}>
                <button
                  type="button"
                  title={opt.title}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full truncate px-3 py-2 text-left text-sm transition-colors hover:bg-white/[0.06] ${
                    opt.value === value ? "bg-white/[0.08] text-ink-50" : "text-ink-300"
                  }`}
                >
                  {opt.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
