import React, { useState, useEffect, useRef } from 'react';

const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

function ScoreBoard({ scores, botColor }) {
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, marginBottom: 8 }}>SCOREBOARD</div>
      {entries.map(([uid, score], i) => (
        <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: i === 0 ? `${botColor}22` : 'var(--bg-base)', borderRadius: 8, marginBottom: 4, border: i === 0 ? `1px solid ${botColor}44` : '1px solid transparent' }}>
          <span style={{ fontSize: 16 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
          <span style={{ color: i === 0 ? botColor : 'var(--text-primary)', fontWeight: i === 0 ? 700 : 500, fontSize: 14 }}>{uid}</span>
          <span style={{ marginLeft: 'auto', fontWeight: 700, color: botColor }}>{score} pts</span>
        </div>
      ))}
    </div>
  );
}

export default function GameWorkspace({ groupId, botColor = '#6C63FF', initialGameData, onGameMessage }) {
  const [phase, setPhase] = useState('idle'); // idle | active | result
  const [topic, setTopic] = useState('');
  const [rounds, setRounds] = useState(5);
  const [loading, setLoading] = useState(false);
  const [currentQ, setCurrentQ] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [scores, setScores] = useState({});
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(null);
  const timerRef = useRef(null);

  // Accept game launched from chat @mention
  useEffect(() => {
    if (initialGameData && initialGameData.status === 'started') {
      setPhase('active');
      setCurrentQ(initialGameData.firstQuestion);
      setScores({});
      setSelected(null);
      setResult(null);
      startTimer();
    }
  }, [initialGameData]);

  const startTimer = () => {
    setTimer(30);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const handleStart = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BASE}/api/agent/game/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: groupId || 'preview', topic, rounds }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPhase('active');
      setCurrentQ(data.firstQuestion);
      setScores({});
      setSelected(null);
      setResult(null);
      startTimer();
      onGameMessage?.(`🎮 Game started! Topic: **${topic}** — ${rounds} rounds. Answer in the chat or tap options!`);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleAnswer = async (option) => {
    if (selected || !currentQ) return;
    clearInterval(timerRef.current);
    setSelected(option);

    try {
      const res = await fetch(`${BASE}/api/agent/game/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: groupId || 'preview', userId: 'You', displayName: 'You', answer: option[0] }),
      });
      const data = await res.json();
      setResult(data);
      setScores(data.scores || {});

      if (data.isLastQ) {
        setPhase('result');
        onGameMessage?.(`🏆 Game over! Final scores: ${Object.entries(data.scores || {}).map(([u, s]) => `${u}: ${s}pts`).join(', ')}`);
      } else {
        setTimeout(() => {
          setCurrentQ(data.nextQuestion);
          setSelected(null);
          setResult(null);
          startTimer();
        }, 2500);
      }
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0b14', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 20px', background: `${botColor}18`, borderBottom: `1px solid ${botColor}33`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 22 }}>🎮</span>
        <div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15 }}>Game Engine</div>
          <div style={{ color: botColor, fontSize: 11.5 }}>
            {phase === 'idle' && 'Configure and start a game'}
            {phase === 'active' && `Round ${currentQ?.number}/${currentQ?.total} · ${timer}s`}
            {phase === 'result' && 'Game Over!'}
          </div>
        </div>
        {phase !== 'idle' && (
          <button onClick={() => { setPhase('idle'); clearInterval(timerRef.current); }}
            style={{ marginLeft: 'auto', background: 'var(--bg-overlay)', border: 'none', color: 'var(--text-muted)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>
            New Game
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

        {/* ── Idle: Setup ── */}
        {phase === 'idle' && (
          <div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: 6, fontSize: 16 }}>🎯 Start a Trivia Game</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
              Or @mention this bot in the group chat: <code style={{ color: botColor }}>@BotName start [topic]</code>
            </p>

            <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 0.8 }}>TOPIC</label>
            <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleStart()}
              placeholder="e.g. Bollywood, Indian History, Cricket, Science..."
              style={{ width: '100%', background: 'var(--bg-overlay)', border: `1px solid ${botColor}44`, borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, outline: 'none', marginTop: 8, marginBottom: 16, boxSizing: 'border-box' }}
            />

            <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 0.8 }}>ROUNDS: {rounds}</label>
            <input type="range" min={3} max={10} value={rounds} onChange={e => setRounds(+e.target.value)}
              style={{ width: '100%', marginTop: 8, marginBottom: 20, accentColor: botColor }}
            />

            {error && <div style={{ color: '#ff4757', fontSize: 13, marginBottom: 12 }}>❌ {error}</div>}

            <button onClick={handleStart} disabled={!topic.trim() || loading}
              style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: topic.trim() && !loading ? botColor : 'var(--bg-overlay)', color: topic.trim() && !loading ? '#fff' : 'var(--text-muted)', fontWeight: 700, fontSize: 15, cursor: topic.trim() && !loading ? 'pointer' : 'default' }}>
              {loading ? '⚡ Generating Questions...' : '🚀 Start Game'}
            </button>
          </div>
        )}

        {/* ── Active: Question ── */}
        {phase === 'active' && currentQ && (
          <div>
            {/* Timer bar */}
            <div style={{ height: 4, background: 'var(--bg-overlay)', borderRadius: 4, marginBottom: 20, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(timer / 30) * 100}%`, background: timer > 10 ? botColor : '#ff4757', borderRadius: 4, transition: 'width 1s linear, background 0.3s' }} />
            </div>

            <div style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
              QUESTION {currentQ.number} of {currentQ.total}
            </div>
            <div style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, lineHeight: 1.4, marginBottom: 24 }}>
              {currentQ.question}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {currentQ.options?.map((opt, i) => {
                const letter = opt[0]; // "A", "B", etc.
                const isSelected = selected === opt;
                const isCorrect = result && letter === result.correctAnswer;
                const isWrong = isSelected && result && !result.correct;

                let bg = 'var(--bg-overlay)';
                let border = '1px solid var(--border)';
                if (isCorrect) { bg = '#00c9a722'; border = '1px solid #00c9a7'; }
                else if (isWrong) { bg = '#ff475722'; border = '1px solid #ff4757'; }
                else if (isSelected) { bg = `${botColor}22`; border = `1px solid ${botColor}`; }

                return (
                  <button key={i} onClick={() => handleAnswer(opt)} disabled={!!selected}
                    style={{ padding: '12px 16px', background: bg, border, borderRadius: 10, color: 'var(--text-primary)', textAlign: 'left', fontSize: 14, cursor: selected ? 'default' : 'pointer', transition: 'all 0.2s', fontWeight: isCorrect ? 700 : 400 }}>
                    {opt} {isCorrect && '✅'} {isWrong && '❌'}
                  </button>
                );
              })}
            </div>

            {result && (
              <div style={{ marginTop: 16, padding: 14, background: 'var(--bg-overlay)', borderRadius: 10, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>
                💡 {result.explanation}
              </div>
            )}

            <ScoreBoard scores={scores} botColor={botColor} />
          </div>
        )}

        {/* ── Result ── */}
        {phase === 'result' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 12 }}>🏆</div>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: 4 }}>Game Over!</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>Topic: {topic}</p>
            <ScoreBoard scores={scores} botColor={botColor} />
            <button onClick={() => setPhase('idle')} style={{ marginTop: 20, padding: '12px 24px', background: botColor, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
              Play Again
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
