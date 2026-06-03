import { forwardRef, useId } from "react";
import type { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

/**
 * Input universal — Design Kit. `.field-group` + `.label` + `.input`,
 * foco com ring do acento, estado de erro (`.is-error` + `.field-error`).
 */
export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, id: providedId, className = "", ...rest },
  ref,
) {
  const generatedId = useId();
  const id = providedId ?? generatedId;

  return (
    <div className="field-group">
      {label && (
        <label htmlFor={id} className="label">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={`input ${error ? "is-error" : ""} ${className}`.trim()}
        aria-invalid={error ? "true" : undefined}
        {...rest}
      />
      {error && (
        <span role="alert" className="field-error">
          {error}
        </span>
      )}
    </div>
  );
});
