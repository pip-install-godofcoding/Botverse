import React, { useState, useRef, useCallback } from 'react';

export default function ArtifactViewer({ artifact, botName }) {
  const [viewMode, setViewMode] = useState('preview'); // 'preview' | 'code'
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const iframeRef = useRef(null);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(artifact.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [artifact.code]);

  const handleRefresh = useCallback(() => {
    if (iframeRef.current) {
      iframeRef.current.srcdoc = artifact.code;
    }
  }, [artifact.code]);

  const iframeProps = {
    ref: iframeRef,
    srcDoc: artifact.code,
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-modals allow-popups',
    style: {
      width: '100%',
      height: isFullscreen ? '100%' : isExpanded ? '600px' : '360px',
      border: 'none',
      borderRadius: isFullscreen ? 0 : '0 0 10px 10px',
      background: '#fff',
      display: viewMode === 'preview' ? 'block' : 'none',
      transition: 'height 0.3s ease',
    },
    title: artifact.title,
  };

  const containerStyle = isFullscreen ? {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: '#0a0b14',
    display: 'flex',
    flexDirection: 'column',
  } : {
    marginTop: 10,
    border: '1px solid #2a2d45',
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
    maxWidth: '100%',
    background: '#111425',
  };

  return (
    <>
      <div style={containerStyle}>
        {/* Title Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px',
          background: '#0d1021',
          borderBottom: '1px solid #2a2d45',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>
              {artifact.type === 'html' ? '🖥️' : '📄'}
            </span>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{artifact.title}</div>
              {botName && (
                <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>Built by {botName}</div>
              )}
            </div>
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {/* Preview / Code toggle */}
            <div style={{ display: 'flex', background: '#1a1d2e', borderRadius: 6, overflow: 'hidden', border: '1px solid #2a2d45' }}>
              <button
                onClick={() => setViewMode('preview')}
                style={{
                  padding: '5px 10px', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: viewMode === 'preview' ? 'var(--accent)' : 'transparent',
                  color: viewMode === 'preview' ? '#000' : 'var(--text-secondary)',
                }}
              >
                Preview
              </button>
              <button
                onClick={() => setViewMode('code')}
                style={{
                  padding: '5px 10px', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: viewMode === 'code' ? 'var(--accent)' : 'transparent',
                  color: viewMode === 'code' ? '#000' : 'var(--text-secondary)',
                }}
              >
                {'</>'}
              </button>
            </div>

            {/* Refresh */}
            <button onClick={handleRefresh} title="Refresh"
              style={{ background: '#1a1d2e', border: '1px solid #2a2d45', borderRadius: 6, padding: '5px 8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
              ↺
            </button>

            {/* Copy */}
            <button onClick={handleCopy} title="Copy code"
              style={{ background: '#1a1d2e', border: '1px solid #2a2d45', borderRadius: 6, padding: '5px 8px', color: copied ? '#00c9a7' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>

            {/* Fullscreen */}
            <button onClick={() => setIsFullscreen(f => !f)} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              style={{ background: '#1a1d2e', border: '1px solid #2a2d45', borderRadius: 6, padding: '5px 8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
              {isFullscreen ? '✕' : '⛶'}
            </button>
          </div>
        </div>

        {/* Live Preview */}
        <iframe {...iframeProps} />

        {/* Code View */}
        {viewMode === 'code' && (
          <div style={{
            height: isFullscreen ? 'calc(100vh - 56px)' : isExpanded ? '600px' : '360px',
            overflowY: 'auto',
            background: '#080a12',
            padding: 16,
            fontFamily: 'monospace',
            fontSize: 12,
            color: '#a8b5d1',
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {artifact.code}
          </div>
        )}

        {/* Expand toggle (only in non-fullscreen) */}
        {!isFullscreen && viewMode === 'preview' && (
          <button
            onClick={() => setIsExpanded(e => !e)}
            style={{
              width: '100%', padding: '7px 0', background: '#0d1021',
              border: 'none', borderTop: '1px solid #2a2d45',
              color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', fontWeight: 600,
            }}
          >
            {isExpanded ? '▲ Collapse' : '▼ Expand'}
          </button>
        )}
      </div>
    </>
  );
}
