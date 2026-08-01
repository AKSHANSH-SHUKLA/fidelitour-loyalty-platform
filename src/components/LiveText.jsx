import React from 'react';

/**
 * LiveText — renders text that CHANGES at runtime, safely under a page
 * translator.
 *
 * THE BUG THIS FIXES
 *   The app runs through a Google-Translate layer, which walks the DOM and
 *   replaces text nodes in place with its own translated nodes. When React
 *   later updates only the TEXT of an existing element, the translator does not
 *   always re-process it — so the visitor keeps seeing the previously cached
 *   translation while the underlying value has already changed.
 *
 *   Real symptom this caused: the Tax Shield showed "DGFiP compliance not
 *   enabled" next to a score of 77 that could only be produced by DGFiP being
 *   ENABLED. The numbers (which the translator does not touch) were right; the
 *   sentence next to them was stale. The product looked broken while behaving
 *   correctly — the worst possible failure mode.
 *
 * THE FIX
 *   Key the element by its own content. When the text changes, React unmounts
 *   the old node and mounts a new one, which the translator then processes
 *   fresh. Cheap, and invisible when no translator is present.
 *
 * USE IT FOR: statuses, alerts, score breakdowns, toasts, counters with words —
 * anything whose text can change without the component unmounting.
 * DON'T BOTHER FOR: static labels, headings, placeholders.
 */
export default function LiveText({ children, as: Tag = 'span', ...rest }) {
  const key = typeof children === 'string' || typeof children === 'number'
    ? String(children)
    : undefined;
  return <Tag key={key} {...rest}>{children}</Tag>;
}
