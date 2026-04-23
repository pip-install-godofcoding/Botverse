import React, { useState, useRef, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

const BASE = import.meta.env.VITE_BACKEND_URL || 'https://botverse-production.up.railway.app';

const OPERATIONS = [
  { id: 'trim',    label: '✂️ Trim',          hint: 'e.g. "trim from 0:10 to 1:45"' },
  { id: 'mute',    label: '🔇 Mute Audio',    hint: 'Remove all audio from the video' },
  { id: 'speed',   label: '⚡ Change Speed',  hint: 'e.g. "2x speed" or "slow to 0.5x"' },
  { id: 'caption', label: '💬 Add Caption',   hint: 'e.g. "add text Hello World at top"' },
  { id: 'gif',     label: '🎞️ To GIF',        hint: 'Convert a short clip to animated GIF' },
  { id: 'audio',   label: '🎵 Extract Audio', hint: 'Save only the audio as MP3' },
];

export default function VideoEditor({ bot, onSendInstruction }) {
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [outputUrl, setOutputUrl] = useState(null);
  const [outputName, setOutputName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError]   = useState('');
  const [pendingOp, setPendingOp] = useState(null);
  const [opInput, setOpInput] = useState('');
  const ffmpegRef = useRef(null);
  const dropRef = useRef(null);

  const parseInstruction = async (instruction, file) => {
    try {
      const res = await fetch(`${BASE}/api/agent/infer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botPrompt: bot?.prompt || 'You are a video editor bot.',
          botCapabilities: ['video_trim', 'video_speed', 'video_caption', 'video_extract_audio', 'video_mute'],
          userMessage: instruction,
        }),
      });
      return await res.json();
    } catch {
      return { type: 'chat' };
    }
  };

  const runFFmpeg = async (file, instruction) => {
    setProcessing(true);
    setProgress(0);
    setError('');
    setOutputUrl(null);
    setStatusMsg('Loading FFmpeg engine...');

    try {
      if (!ffmpegRef.current) {
        ffmpegRef.current = new FFmpeg();
        ffmpegRef.current.on('progress', ({ progress: p }) => {
          setProgress(Math.round(p * 100));
        });
      }
      const ffmpeg = ffmpegRef.current;
      if (!ffmpeg.loaded) {
        await ffmpeg.load({
          coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
        });
      }

      setStatusMsg('Analysing your instruction...');
      const inferred = await parseInstruction(instruction, file);
      const { action, params } = inferred.type === 'action' ? inferred : { action: null, params: {} };

      const inputName = 'input.' + file.name.split('.').pop();
      await ffmpeg.writeFile(inputName, await fetchFile(file));
      setStatusMsg('Processing video...');

      let outputFile = 'output.mp4';
      let args = [];

      if (action === 'video_trim' || instruction.match(/trim|cut|clip/i)) {
        const start = params?.start || '00:00:00';
        const end   = params?.end   || '00:00:30';
        args = ['-ss', start, '-to', end, '-i', inputName, '-c', 'copy', outputFile];
      } else if (action === 'video_mute' || instruction.match(/mute|no audio|silent/i)) {
        args = ['-i', inputName, '-an', outputFile];
      } else if (action === 'video_speed' || instruction.match(/speed|slow|fast/i)) {
        const speed = params?.speed || (instruction.match(/(\d+\.?\d*)x/)?.[1] || 2);
        const pts = (1 / speed).toFixed(4);
        args = ['-i', inputName, '-vf', `setpts=${pts}*PTS`, '-af', `atempo=${Math.min(Math.max(speed, 0.5), 2.0)}`, outputFile];
      } else if (action === 'video_extract_audio' || instruction.match(/extract audio|save audio|mp3/i)) {
        outputFile = 'output.mp3';
        args = ['-i', inputName, '-vn', '-acodec', 'libmp3lame', outputFile];
      } else if (action === 'video_caption' || instruction.match(/caption|text|overlay|title/i)) {
        const text = params?.text || instruction.replace(/add (text|caption|title)/i, '').trim().substring(0, 50);
        const y = params?.position === 'bottom' ? 'h-th-10' : '10';
        args = ['-i', inputName, '-vf', `drawtext=text='${text}':fontsize=36:fontcolor=white:x=(w-tw)/2:y=${y}:box=1:boxcolor=black@0.5`, outputFile];
      } else if (instruction.match(/gif/i)) {
        outputFile = 'output.gif';
        args = ['-i', inputName, '-t', '5', '-vf', 'fps=10,scale=480:-1:flags=lanczos', outputFile];
      } else {
        // Default: just copy/re-encode
        args = ['-i', inputName, '-c', 'copy', outputFile];
      }

      await ffmpeg.exec(args);

      const data = await ffmpeg.readFile(outputFile);
      const mime = outputFile.endsWith('.mp3') ? 'audio/mpeg' : outputFile.endsWith('.gif') ? 'image/gif' : 'video/mp4';
      const blob = new Blob([data.buffer], { type: mime });
      const url = URL.createObjectURL(blob);
      setOutputUrl(url);
      setOutputName(outputFile);
      setStatusMsg('Done! ✅');
      setProgress(100);
    } catch (e) {
      setError('Processing failed: ' + e.message);
      setStatusMsg('');
    }
    setProcessing(false);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0] || e.target.files?.[0];
    if (f && f.type.startsWith('video/')) {
      setVideoFile(f);
      setVideoUrl(URL.createObjectURL(f));
      setOutputUrl(null);
      setError('');
    }
  }, []);

  const handleProcess = () => {
    if (!videoFile || !opInput.trim()) return;
    runFFmpeg(videoFile, opInput);
    onSendInstruction?.(opInput);
    setOpInput('');
    setPendingOp(null);
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0b14', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', background: '#1a1d2e', borderBottom: '1px solid #2a2d45', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }}>🎬</span>
        <div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15 }}>Video Editor</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Powered by FFmpeg WebAssembly — runs 100% in your browser</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Upload zone */}
        {!videoFile ? (
          <div ref={dropRef} onDrop={handleDrop} onDragOver={e => e.preventDefault()}
            style={{ border: '2px dashed #2a2d45', borderRadius: 14, padding: 40, textAlign: 'center', cursor: 'pointer', background: '#11131f' }}
            onClick={() => document.getElementById('vid-upload').click()}>
            <input id="vid-upload" type="file" accept="video/*" style={{ display: 'none' }} onChange={handleDrop} />
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎬</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Drop your video here</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>MP4, MOV, AVI, WebM supported</div>
          </div>
        ) : (
          <>
            {/* Video preview */}
            <video src={videoUrl} controls style={{ width: '100%', borderRadius: 10, background: '#000', maxHeight: 200 }} />
            <div style={{ color: 'var(--text-muted)', fontSize: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
              <span>📁 {videoFile.name}</span>
              <button onClick={() => { setVideoFile(null); setVideoUrl(null); setOutputUrl(null); }}
                style={{ background: 'none', border: 'none', color: '#ff4757', cursor: 'pointer', fontSize: 12 }}>✕ Remove</button>
            </div>

            {/* Quick operations */}
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, marginBottom: 10 }}>QUICK OPERATIONS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {OPERATIONS.map(op => (
                  <button key={op.id} onClick={() => { setPendingOp(op); setOpInput(op.hint); }}
                    style={{ padding: '7px 14px', background: pendingOp?.id === op.id ? '#6C63FF33' : 'var(--bg-overlay)', border: `1px solid ${pendingOp?.id === op.id ? '#6C63FF' : 'var(--border)'}`, borderRadius: 20, color: pendingOp?.id === op.id ? '#6C63FF' : 'var(--text-secondary)', fontSize: 12.5, cursor: 'pointer', fontWeight: 600 }}>
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Instruction input */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={opInput} onChange={e => setOpInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleProcess()}
                placeholder='Describe what you want, e.g. "trim from 0:10 to 0:45"'
                style={{ flex: 1, background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 13.5, outline: 'none' }}
              />
              <button onClick={handleProcess} disabled={!opInput.trim() || processing}
                style={{ padding: '10px 18px', background: opInput.trim() && !processing ? '#6C63FF' : 'var(--bg-overlay)', border: 'none', borderRadius: 10, color: opInput.trim() && !processing ? '#fff' : 'var(--text-muted)', fontWeight: 700, cursor: opInput.trim() && !processing ? 'pointer' : 'default' }}>
                {processing ? '⚙️' : '▶'}
              </button>
            </div>

            {/* Progress */}
            {processing && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{statusMsg}</span>
                  <span style={{ color: '#6C63FF', fontSize: 12, fontWeight: 700 }}>{progress}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-overlay)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #6C63FF, #5ac8fa)', borderRadius: 4, transition: 'width 0.3s' }} />
                </div>
              </div>
            )}

            {error && <div style={{ color: '#ff4757', fontSize: 13, padding: 10, background: '#ff475715', borderRadius: 8 }}>❌ {error}</div>}

            {/* Output */}
            {outputUrl && (
              <div style={{ background: '#0f2212', border: '1px solid #1a3d1c', borderRadius: 12, padding: 16 }}>
                <div style={{ color: '#39ff14', fontWeight: 700, fontSize: 14, marginBottom: 10 }}>✅ Processing Complete!</div>
                {outputName.endsWith('.mp3') ? (
                  <audio src={outputUrl} controls style={{ width: '100%' }} />
                ) : outputName.endsWith('.gif') ? (
                  <img src={outputUrl} alt="output gif" style={{ width: '100%', borderRadius: 8 }} />
                ) : (
                  <video src={outputUrl} controls style={{ width: '100%', borderRadius: 8, maxHeight: 200 }} />
                )}
                <a href={outputUrl} download={outputName}
                  style={{ display: 'block', marginTop: 12, padding: '10px 0', textAlign: 'center', background: '#39ff1422', border: '1px solid #39ff1444', borderRadius: 8, color: '#39ff14', fontWeight: 700, fontSize: 14 }}>
                  ⬇️ Download {outputName}
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
