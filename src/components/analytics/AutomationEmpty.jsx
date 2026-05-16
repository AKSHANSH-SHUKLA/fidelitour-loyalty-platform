/**
 * AutomationEmpty — dashed CTA tile inviting the owner to create a new
 * automation. Lights up purple on hover.
 */
import React from 'react';
import { Plus } from 'lucide-react';

const AutomationEmpty = ({ onClick, label = 'Créer' }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`${label} une automatisation`}
    style={{
      border: '1px dashed hsl(228 30% 26%)',
      borderRadius: 14,
      padding: 12,
      background: 'transparent',
      color: 'hsl(228 11% 60%)',
      cursor: 'pointer',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 6,
      fontSize: 12,
      minHeight: 92,
      font: 'inherit',
      transition: 'border-color 180ms ease, color 180ms ease, background 180ms ease',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = 'hsl(258 90% 66% / .55)';
      e.currentTarget.style.color = 'hsl(252 95% 85%)';
      e.currentTarget.style.background = 'hsl(258 90% 66% / .04)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = 'hsl(228 30% 26%)';
      e.currentTarget.style.color = 'hsl(228 11% 60%)';
      e.currentTarget.style.background = 'transparent';
    }}
  >
    <Plus size={16} aria-hidden="true" />
    {label}
  </button>
);

export default AutomationEmpty;
