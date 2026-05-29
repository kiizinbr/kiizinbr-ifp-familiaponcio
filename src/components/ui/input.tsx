import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, CSSProperties } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

/**
 * Input universal canônico do DS v2.
 * Com label associada via useId(), error state, focus laranja.
 */
export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, id: providedId, style, className = "", ...rest },
  ref,
) {
  const generatedId = useId();
  const id = providedId ?? generatedId;

  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    fontSize: "14px",
    color: "rgb(var(--ifp-ink))",
    backgroundColor: "rgb(var(--ifp-canvas))",
    border: error ? "1px solid rgb(var(--ifp-danger))" : "1px solid rgb(var(--ifp-surface-200))",
    borderRadius: "var(--ifp-radius-sm)",
    outline: "none",
    transition: "border-color var(--ifp-transition-fast)",
    ...style,
  };

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm" style={{ color: "rgb(var(--ifp-muted))" }}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        style={inputStyle}
        className={className}
        aria-invalid={error ? "true" : undefined}
        {...rest}
      />
      {error && (
        <span role="alert" className="text-xs" style={{ color: "rgb(var(--ifp-danger))" }}>
          {error}
        </span>
      )}
    </div>
  );
});
