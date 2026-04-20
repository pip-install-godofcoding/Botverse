import React, { useRef, useEffect, useState } from 'react';
import { socket } from '../../../lib/socket';

export default function SmartBoard({ boardId }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#fff');
  const [lineWidth, setLineWidth] = useState(3);
  
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Make canvas responsive to exact container size
    const resize = () => {
      const parent = canvas.parentElement;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };
    resize();
    window.addEventListener('resize', resize);

    if (boardId) {
      socket.emit('join-board', { boardId });
    }

    const drawLine = ({ x0, y0, x1, y1, color, width }) => {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
      ctx.closePath();
    };

    socket.on('draw-line', drawLine);
    socket.on('clear-board', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    return () => {
      window.removeEventListener('resize', resize);
      socket.off('draw-line', drawLine);
      socket.off('clear-board');
    };
  }, [boardId]);

  const getCoordinates = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX : e.clientX;
    const y = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: x - rect.left, y: y - rect.top };
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    lastPos.current = getCoordinates(e);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const newPos = getCoordinates(e);
    const line = {
      x0: lastPos.current.x,
      y0: lastPos.current.y,
      x1: newPos.x,
      y1: newPos.y,
      color,
      width: lineWidth,
    };
    
    // Draw locally immediately
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(line.x0, line.y0);
    ctx.lineTo(line.x1, line.y1);
    ctx.strokeStyle = line.color;
    ctx.lineWidth = line.width;
    ctx.stroke();
    ctx.closePath();

    // Broadcast
    if (boardId) {
      socket.emit('draw-line', { boardId, line });
    }
    
    lastPos.current = newPos;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    if (boardId) socket.emit('clear-board', { boardId });
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0a1a0d' }}>
      <div style={{ padding: '10px 16px', background: '#0f2212', borderBottom: '1px solid #1a2e1d', display: 'flex', alignItems: 'center', gap: 12 }}>
        <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: 15 }}>Collaborative Smart Board</h3>
        
        <div style={{ height: 20, width: 1, background: '#2a3e2d', margin: '0 8px' }} />
        
        {['#fff', '#fa243c', '#ffb800', '#00e5ff', '#39ff14'].map(c => (
          <button key={c} onClick={() => setColor(c)}
            style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: color === c ? '3px solid #6C63FF' : '2px solid transparent', cursor: 'pointer' }}
          />
        ))}

        <div style={{ flex: 1 }} />
        
        <button onClick={handleClear} style={{ background: '#fa243c33', color: '#fa243c', border: 'none', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
          Clear Board
        </button>
      </div>
      
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{ width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair' }}
        />
      </div>
    </div>
  );
}
