import React, { useEffect, useRef, useState } from 'react';

/**
 * NumberInput
 * -----------
 * A drop-in replacement for <input type="number"> that does NOT snap back to
 * the previous value when the user clears the field. The standard pattern
 *
 *     <input type="number" value={n} onChange={e => setN(Number(e.target.value))}/>
 *
 * is broken because clearing the field makes `Number("")` return `0`, which
 * immediately re-renders the input as "0" — so users can never delete the
 * leading digit and type a fresh number. This component keeps an internal
 * draft string so the input reflects exactly what the user typed (including
 * an empty field), and only commits a clamped numeric value back to the
 * parent on blur or Enter.
 *
 * Also commits valid intermediate values via onChange while typing so consumers
 * that drive previews or filters from the value still update live.
 *
 * Props that match a normal input pass through (placeholder, className,
 * style, disabled, autoFocus, etc.). `min` / `max` are clamped on commit.
 */
export default function NumberInput({
  value,
  onChange,
  onCommit,
  min,
  max,
  step,
  emptyValue = 0,         // what to send to the parent when the field is empty on blur
  allowEmpty = true,      // if false, blank values snap to `min` (or 0)
  className = '',
  style,
  placeholder,
  disabled,
  autoFocus,
  inputMode = 'numeric',
  ...rest
}) {
  const [draft, setDraft] = useState(
    value === undefined || value === null ? '' : String(value)
  );
  const focused = useRef(false);

  // Sync draft when the parent's value changes externally (e.g. resetForm)
  // — but only when the user isn't actively editing this field.
  useEffect(() => {
    if (focused.current) return;
    const next = value === undefined || value === null ? '' : String(value);
    if (next !== draft) setDraft(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const clamp = (n) => {
    let r = n;
    if (typeof min === 'number' && r < min) r = min;
    if (typeof max === 'number' && r > max) r = max;
    return r;
  };

  const handleChange = (e) => {
    const raw = e.target.value;
    setDraft(raw);
    if (raw === '' || raw === '-' || raw === '.') {
      // Defer parent update — let the user keep typing.
      return;
    }
    const n = Number(raw);
    if (!Number.isNaN(n)) {
      onChange?.(clamp(n));
    }
  };

  const commit = (raw) => {
    const trimmed = (raw ?? '').toString().trim();
    if (trimmed === '' || trimmed === '-' || trimmed === '.') {
      const fallback = allowEmpty ? emptyValue : clamp(typeof min === 'number' ? min : 0);
      onChange?.(fallback);
      onCommit?.(fallback);
      // Display the committed fallback unless allowEmpty wants the field to stay blank.
      setDraft(allowEmpty && (fallback === 0 || fallback === '') ? '' : String(fallback));
      return;
    }
    const n = Number(trimmed);
    if (Number.isNaN(n)) {
      const fallback = clamp(typeof min === 'number' ? min : 0);
      onChange?.(fallback);
      onCommit?.(fallback);
      setDraft(String(fallback));
      return;
    }
    const clamped = clamp(n);
    onChange?.(clamped);
    onCommit?.(clamped);
    setDraft(String(clamped));
  };

  const handleBlur = (e) => {
    focused.current = false;
    commit(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      commit(e.currentTarget.value);
      e.currentTarget.blur();
    }
    rest.onKeyDown?.(e);
  };

  // Avoid double-handling onKeyDown.
  const restClean = { ...rest };
  delete restClean.onKeyDown;

  return (
    <input
      type="number"
      inputMode={inputMode}
      value={draft}
      onChange={handleChange}
      onFocus={() => { focused.current = true; }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      step={step}
      min={min}
      max={max}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      className={className}
      style={style}
      {...restClean}
    />
  );
}
