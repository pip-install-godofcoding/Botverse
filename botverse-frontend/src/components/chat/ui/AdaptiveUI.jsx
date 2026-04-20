import React from 'react';

// Generative UI Renderer component
export default function AdaptiveUI({ payload, currentUser, onAction }) {
  if (!payload || !payload.type) return null;

  // ─── Privacy Check ──────────────────────────────────────────────────────────
  if (payload.target) {
    const isTarget = currentUser && currentUser.toLowerCase() === payload.target.toLowerCase();
    if (!isTarget) {
      return (
        <div style={{ padding: '12px 16px', background: '#0a0d1a', border: '1px solid #1a1d2e', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13, marginTop: 8, maxWidth: 300 }}>
          <span style={{ fontSize: 18 }}>🔒</span>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Private Interface</div>
            <div>Hidden message for {payload.target}</div>
          </div>
        </div>
      );
    }
  }

  // ─── Generic Grid (for cards, items, products) ──────────────────────────────
  if (payload.type === 'grid') {
    return (
      <div style={{ marginTop: 8, background: '#0a0d1a', border: '1px solid #1a1d2e', borderRadius: 12, padding: 16, width: '100%', overflow: 'hidden' }}>
        {payload.image && (
          <img src={payload.image} alt="UI Graphic" onError={(e) => { e.target.style.display = 'none'; }} style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 8, marginBottom: 12 }} />
        )}
        {payload.title && <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 12 }}>{payload.title}</div>}
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10 }}>
          {Array.isArray(payload.items) && payload.items.map((item, idx) => (
            <div key={idx} style={{ background: item?.color || '#1a1d2e', padding: '12px 8px', borderRadius: 8, textAlign: 'center', position: 'relative', border: '1px solid rgba(255,255,255,0.1)' }}>
              {item?.label && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{item.label}</div>}
              <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: '4px 0' }}>{item?.value || item?.text || (typeof item === 'string' ? item : '')}</div>
            </div>
          ))}
        </div>

        {Array.isArray(payload.buttons) && payload.buttons.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {payload.buttons.map((btn, i) => {
              const text = btn?.label || (typeof btn === 'string' ? btn : 'Action');
              const actionVal = btn?.action || text;
              return (
                <button key={i} onClick={() => onAction && onAction(actionVal)} 
                  style={{ flex: 1, padding: '8px 0', background: 'var(--accent)', border: 'none', borderRadius: 6, color: '#0a0b14', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                  {text}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── Dashboard (for Key-Value stats like Weather, Flight, Crypto) ─────────────
  if (payload.type === 'dashboard') {
    return (
      <div style={{ marginTop: 8, background: 'linear-gradient(145deg, #111425, #080a12)', border: '1px solid #2a2d45', borderRadius: 12, padding: 16, width: '100%', overflow: 'hidden' }}>
        {payload.image && (
          <img src={payload.image} alt="UI Graphic" onError={(e) => { e.target.style.display = 'none'; }} style={{ width: 'calc(100% + 32px)', margin: '-16px -16px 16px -16px', height: 140, objectFit: 'cover', display: 'block' }} />
        )}
        {payload.title && <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          {payload.icon && <span>{payload.icon}</span>} {payload.title}
        </div>}
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.isArray(payload.fields) && payload.fields.map((field, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: idx < payload.fields.length - 1 ? '1px solid #1a1d2e' : 'none', paddingBottom: idx < payload.fields.length - 1 ? 12 : 0 }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>{field?.label || ''}</span>
              <span style={{ color: field?.color || '#00c9a7', fontSize: 14, fontWeight: 700 }}>{field?.value || ''}</span>
            </div>
          ))}
        </div>

        {Array.isArray(payload.buttons) && payload.buttons.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            {payload.buttons.map((btn, i) => {
              const text = btn?.label || (typeof btn === 'string' ? btn : 'Action');
              const actionVal = btn?.action || text;
              return (
                <button key={i} onClick={() => onAction && onAction(actionVal)} 
                  style={{ flex: 1, padding: '8px 0', background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  {text}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Fallback for unknown types
  return (
    <div style={{ marginTop: 8, padding: 10, background: '#1a1d2e', borderRadius: 8, fontSize: 12, color: 'var(--red)' }}>
      Unknown UI format: {payload.type}
    </div>
  );
}
