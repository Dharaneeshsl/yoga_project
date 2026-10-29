import React, { useEffect, useRef, useCallback } from 'react';
import { classifyScore } from '../utils/poseUtils';

const FinalScreen = ({
  results = [],
  levels = [],
  onRestart,
  onDownload
}) => {
  const canvasRef = useRef(null);

  // Compute average only on completed levels
  const completedResults = results.filter(r => r && typeof r.score === 'number');
  const totalScore = completedResults.reduce((acc, r) => acc + r.score, 0);
  const averageScore = completedResults.length > 0 ? Math.round(totalScore / completedResults.length) : 0;
  const classification = classifyScore(averageScore);

  // Confetti effect if average score >= 65 and user does not prefer reduced motion
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || averageScore < 65) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#10b981', '#34d399', '#38bdf8', '#fbbf24', '#f472b6', '#a78bfa'];

    for (let i = 0; i < 90; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height,
        w: Math.random() * 8 + 4,
        h: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vy: Math.random() * 3 + 2,
        vx: (Math.random() - 0.5) * 2,
        rotation: Math.random() * 360,
        vr: (Math.random() - 0.5) * 4
      });
    }

    let animId;
    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of pieces) {
        p.y += p.vy;
        p.x += p.vx;
        p.rotation += p.vr;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();

        if (p.y > canvas.height) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
        }
      }
      animId = requestAnimationFrame(render);
    }

    animId = requestAnimationFrame(render);

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [averageScore]);

  // Export shareable PNG card
  const handleExportCardImage = useCallback(() => {
    const cardCanvas = document.createElement('canvas');
    cardCanvas.width = 800;
    cardCanvas.height = 600;
    const ctx = cardCanvas.getContext('2d');

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 800, 600);
    grad.addColorStop(0, '#f0fdf4');
    grad.addColorStop(1, '#ecfdf5');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 600);

    // Border
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 8;
    ctx.strokeRect(16, 16, 768, 568);

    // Header
    ctx.fillStyle = '#064e3b';
    ctx.font = 'bold 36px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PoseYoga Flow Achievement', 400, 80);

    ctx.font = '18px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#047857';
    ctx.fillText('100% On-Device AI Posture Analysis', 400, 115);

    // Score Circle
    ctx.beginPath();
    ctx.arc(400, 220, 70, 0, Math.PI * 2);
    ctx.fillStyle = '#059669';
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 50px Inter, system-ui, sans-serif';
    ctx.fillText(`${averageScore}%`, 400, 235);

    ctx.font = 'bold 22px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#064e3b';
    ctx.fillText(classification.label, 400, 325);

    // Levels list
    ctx.font = '16px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    let y = 375;
    completedResults.slice(0, 5).forEach((r, i) => {
      ctx.fillStyle = '#0f172a';
      ctx.fillText(`• Level ${r.levelId || i + 1}: ${r.levelName || 'Pose'}`, 180, y);
      ctx.fillStyle = '#059669';
      ctx.fillText(`${r.score}%`, 600, y);
      y += 32;
    });

    // Date
    ctx.textAlign = 'center';
    ctx.font = '14px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`Completed on ${new Date().toLocaleDateString()}`, 400, 550);

    const dataUrl = cardCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `poseyoga-achievement-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [averageScore, classification.label, completedResults]);

  return (
    <div className="final-screen-container">
      {/* Background Confetti Canvas */}
      <canvas ref={canvasRef} className="confetti-canvas"></canvas>

      <div className="final-summary-card">
        <div className="celebration-badge">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
            <path d="M4 22h16"></path>
            <path d="M10 14.66V17c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-2.34"></path>
            <path d="M18 14.66V17c0 .55-.45 1-1 1h-2c-.55 0-1-.45-1-1v-2.34"></path>
            <path d="M14 6v8a2 2 0 0 1-2 2h0a2 2 0 0 1-2-2V6"></path>
          </svg>
          <span>Practice Journey Completed!</span>
        </div>

        <h1 className="final-hero-title">Namaste, Yogi</h1>
        <p className="final-hero-desc">
          You completed {completedResults.length} yoga pose levels. Here is your overall practice summary.
        </p>

        {/* Big Overall Score */}
        <div className="final-score-display">
          <div className="final-score-number">{averageScore}%</div>
          <div
            className="final-classification-pill"
            style={{
              backgroundColor: classification.bg,
              color: classification.text,
              border: `1.5px solid ${classification.color}`
            }}
          >
            {classification.label}
          </div>
        </div>

        {/* Per-Pose Level Breakdown Cards */}
        <div className="final-levels-grid">
          {levels.map((lvl, idx) => {
            const res = results[idx];
            const score = res?.score ?? '—';
            const cls = typeof score === 'number' ? classifyScore(score) : null;

            return (
              <div key={lvl.id} className="final-level-item">
                <img src={lvl.image} alt={lvl.name} className="final-pose-thumb" />
                <div className="final-pose-info">
                  <span className="final-pose-level">Level {lvl.id}</span>
                  <h4 className="final-pose-name">{lvl.name}</h4>
                </div>
                <div className="final-pose-score">
                  <span className="score-val">{typeof score === 'number' ? `${score}%` : 'Skipped'}</span>
                  {cls && (
                    <span className="score-chip" style={{ color: cls.color }}>
                      {cls.badge}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Final Actions */}
        <div className="final-actions-row">
          <button className="btn btn-primary btn-large" onClick={onRestart}>
            <span>Practice Again</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
            </svg>
          </button>

          <button className="btn btn-secondary btn-large" onClick={handleExportCardImage}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <span>Save Result Card (PNG)</span>
          </button>

          <button className="btn btn-ghost" onClick={onDownload}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Export JSON</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinalScreen;
