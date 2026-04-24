"use client";
import React, { useEffect, useRef, useState, useCallback } from 'react';
import './globals.css';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const PIECES = [
  { shape: [[1,1,1,1]], color: '#00e5ff', color2: '#ff4081', name: '캡슐', icon: '💊' },
  { shape: [[1,1],[1,1]], color: '#ffd740', color2: '#ff6d00', name: '정제', icon: '🟡' },
  { shape: [[0,1,0],[1,1,1]], color: '#69f0ae', color2: '#00897b', name: '좌약', icon: '💉' },
  { shape: [[0,1,1],[1,1,0]], color: '#ea80fc', color2: '#aa00ff', name: '앰플', icon: '🧪' },
  { shape: [[1,1,0],[0,1,1]], color: '#ff6e40', color2: '#bf360c', name: '주사기', icon: '💉' },
  { shape: [[1,0,0],[1,1,1]], color: '#40c4ff', color2: '#0277bd', name: '연고', icon: '🧴' },
  { shape: [[0,0,1],[1,1,1]], color: '#ccff90', color2: '#558b2f', name: '파스', icon: '🩹' },
];

export default function PharmaTetris() {
  const canvasRef = useRef(null);
  const nextCanvasRef = useRef(null);
  
  // React UI States
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [best, setBest] = useState(0);
  const [gameState, setGameState] = useState('ready'); // 'ready', 'playing', 'gameover'

  // Game Engine Refs (React 렌더링에 영향받지 않도록 useRef 사용)
  const game = useRef({
    board: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
    current: null,
    next: null,
    dropInterval: 800,
    dropAcc: 0,
    lastTime: 0,
    animId: null,
    paused: false,
    score: 0,
    level: 1,
    lines: 0
  });

  // 초기 최고점수 불러오기
  useEffect(() => {
    const savedBest = parseInt(localStorage.getItem('pharma_best') || '0', 10);
    setBest(savedBest);
  }, []);

  const randomPiece = () => {
    const p = PIECES[Math.floor(Math.random() * PIECES.length)];
    return {
      shape: p.shape.map(r => [...r]),
      color: p.color, color2: p.color2, name: p.name, icon: p.icon,
      x: Math.floor(COLS / 2) - Math.floor(p.shape[0].length / 2),
      y: 0
    };
  };

  const valid = (shape, ox, oy, currentBoard) => {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          const nx = ox + c, ny = oy + r;
          if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
          if (ny >= 0 && currentBoard[ny][nx]) return false;
        }
      }
    }
    return true;
  };

  const rotate = (shape) => {
    const rows = shape.length, cols = shape[0].length;
    const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        rotated[c][rows - 1 - r] = shape[r][c];
    return rotated;
  };

  const ghostY = () => {
    let gy = game.current.current.y;
    while (valid(game.current.current.shape, game.current.current.x, gy + 1, game.current.board)) gy++;
    return gy;
  };

  const drawBlock = (ctx, x, y, color, color2, size = BLOCK) => {
    const g = ctx.createLinearGradient(x, y, x + size, y + size);
    g.addColorStop(0, color);
    g.addColorStop(1, color2 || color);
    ctx.fillStyle = g;
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x + 2, y + 2, size - 4, Math.floor(size * 0.3));
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);
  };

  const drawPill = (ctx, x, y, color, color2, size = BLOCK, isGhost = false) => {
    if (isGhost) {
      ctx.fillStyle = color + '22';
      ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
      ctx.strokeStyle = color + '55';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);
      return;
    }
    drawBlock(ctx, x, y, color, color2, size);
  };

  const drawNext = useCallback(() => {
    const nCtx = nextCanvasRef.current.getContext('2d');
    nCtx.clearRect(0, 0, 120, 80);
    const next = game.current.next;
    if (!next) return;
    const s = 20;
    const offX = Math.floor((6 - next.shape[0].length) / 2) * s;
    const offY = Math.floor((4 - next.shape.length) / 2) * s;
    for (let r = 0; r < next.shape.length; r++)
      for (let c = 0; c < next.shape[r].length; c++)
        if (next.shape[r][c])
          drawBlock(nCtx, offX + c * s, offY + r * s, next.color, next.color2, s);
  }, []);

  const drawBoard = useCallback(() => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, COLS * BLOCK, ROWS * BLOCK);

    ctx.strokeStyle = '#0d1a2e';
    ctx.lineWidth = 1;
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * BLOCK); ctx.lineTo(COLS * BLOCK, r * BLOCK); ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * BLOCK, 0); ctx.lineTo(c * BLOCK, ROWS * BLOCK); ctx.stroke();
    }

    const { board, current } = game.current;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (board[r][c])
          drawPill(ctx, c * BLOCK, r * BLOCK, board[r][c].color, board[r][c].color2);

    if (!current) return;

    const gy = ghostY();
    if (gy !== current.y) {
      for (let r = 0; r < current.shape.length; r++)
        for (let c = 0; c < current.shape[r].length; c++)
          if (current.shape[r][c])
            drawPill(ctx, (current.x + c) * BLOCK, (gy + r) * BLOCK, current.color, current.color2, BLOCK, true);
    }

    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawPill(ctx, (current.x + c) * BLOCK, (current.y + r) * BLOCK, current.color, current.color2);
  }, []);

  const syncUI = () => {
    setScore(game.current.score);
    setLevel(game.current.level);
    setLines(game.current.lines);
  };

  const endGame = () => {
    setGameState('gameover');
    cancelAnimationFrame(game.current.animId);
    if (game.current.score > best) {
      setBest(game.current.score);
      localStorage.setItem('pharma_best', game.current.score.toString());
    }
  };

  const clearLines = () => {
    let cleared = 0;
    const b = game.current.board;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (b[r].every(c => c !== null)) {
        b.splice(r, 1);
        b.unshift(Array(COLS).fill(null));
        cleared++;
        r++;
      }
    }
    if (cleared > 0) {
      const pts = [0, 100, 300, 500, 800][cleared] * game.current.level;
      game.current.score += pts;
      game.current.lines += cleared;
      game.current.level = Math.floor(game.current.lines / 10) + 1;
      game.current.dropInterval = Math.max(80, 800 - (game.current.level - 1) * 70);
      syncUI();
    }
  };

  const place = () => {
    const { current, board } = game.current;
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c]) {
          if (current.y + r < 0) { endGame(); return; }
          board[current.y + r][current.x + c] = { color: current.color, color2: current.color2 };
        }
    clearLines();
    game.current.current = game.current.next;
    game.current.next = randomPiece();
    if (!valid(game.current.current.shape, game.current.current.x, game.current.current.y, game.current.board)) {
      endGame();
    }
    drawNext();
  };

  const drop = () => {
    if (!valid(game.current.current.shape, game.current.current.x, game.current.current.y + 1, game.current.board)) {
      place();
    } else {
      game.current.current.y++;
    }
  };

  const hardDrop = () => {
    while (valid(game.current.current.shape, game.current.current.x, game.current.current.y + 1, game.current.board)) {
      game.current.current.y++;
    }
    place();
  };

  const gameLoop = useCallback((ts) => {
    if (game.current.paused || gameState !== 'playing') {
      game.current.animId = requestAnimationFrame(gameLoop);
      return;
    }
    const dt = ts - game.current.lastTime;
    game.current.lastTime = ts;
    game.current.dropAcc += dt;

    if (game.current.dropAcc > game.current.dropInterval) {
      drop();
      game.current.dropAcc = 0;
    }
    drawBoard();
    game.current.animId = requestAnimationFrame(gameLoop);
  }, [gameState, drawBoard]);

  const startGame = () => {
    game.current.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    game.current.score = 0;
    game.current.level = 1;
    game.current.lines = 0;
    game.current.dropInterval = 800;
    game.current.paused = false;
    game.current.current = randomPiece();
    game.current.next = randomPiece();
    game.current.lastTime = performance.now();
    game.current.dropAcc = 0;
    syncUI();
    setGameState('playing');
    drawNext();
    
    if (game.current.animId) cancelAnimationFrame(game.current.animId);
    game.current.animId = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameState !== 'playing') return;
      if (game.current.paused && e.key.toLowerCase() !== 'p') return;

      const { current, board } = game.current;
      switch (e.key) {
        case 'ArrowLeft':
          if (valid(current.shape, current.x - 1, current.y, board)) current.x--;
          e.preventDefault(); break;
        case 'ArrowRight':
          if (valid(current.shape, current.x + 1, current.y, board)) current.x++;
          e.preventDefault(); break;
        case 'ArrowDown':
          drop(); game.current.dropAcc = 0;
          e.preventDefault(); break;
        case 'ArrowUp': case 'z': case 'Z': {
          const r = rotate(current.shape);
          if (valid(r, current.x, current.y, board)) current.shape = r;
          else if (valid(r, current.x - 1, current.y, board)) { current.shape = r; current.x--; }
          else if (valid(r, current.x + 1, current.y, board)) { current.shape = r; current.x++; }
          e.preventDefault(); break;
        }
        case ' ':
          hardDrop();
          e.preventDefault(); break;
        case 'p': case 'P':
          game.current.paused = !game.current.paused;
          break;
      }
      if (!game.current.paused) drawBoard();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [gameState, drawBoard]);

  return (
    <>
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <h1>💊 PHARMA TETRIS</h1>
        <p className="sub">의약품 낙하 게임 · DOSE CONTROL SYSTEM</p>
      </div>

      <div className="wrapper">
        <div className="side-panel">
          <div className="panel-box">
            <div className="panel-label">점수 · Score</div>
            <div className="panel-value">{score}</div>
          </div>
          <div className="panel-box">
            <div className="panel-label">레벨 · Level</div>
            <div className="panel-value">{level}</div>
            <div id="level-bar-wrap">
              <div id="level-bar" style={{ width: `${(lines % 10) * 10}%` }}></div>
            </div>
          </div>
          <div className="panel-box">
            <div className="panel-label">라인 · Lines</div>
            <div className="panel-value">{lines}</div>
          </div>
          <div className="panel-box">
            <div className="panel-label">의약품 종류</div>
            <div className="pill-legend">
              {PIECES.map((p, i) => (
                <div key={i} className="legend-item">
                  <div className="legend-dot" style={{ background: p.color }}></div>
                  {p.icon} {p.name}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div id="game-area">
          <div id="board-wrap">
            <canvas ref={canvasRef} width={COLS * BLOCK} height={ROWS * BLOCK}></canvas>
            
            {gameState === 'ready' && (
              <div id="overlay">
                <h2>PHARMA TETRIS</h2>
                <p>의약품을 쌓아 라인을 완성하세요</p>
                <button className="start-btn" onClick={startGame}>START DOSING</button>
              </div>
            )}

            {gameState === 'gameover' && (
              <div id="overlay">
                <h2>GAME OVER</h2>
                <p style={{ color: '#c8d8e8', fontSize: '0.8rem' }}>
                  최종 점수: <span style={{ color: '#00e5ff' }}>{score}</span>
                </p>
                <p style={{ color: '#3a4a6a', fontSize: '0.65rem', letterSpacing: '0.2em' }}>
                  BEST: {best}
                </p>
                <button className="start-btn" onClick={startGame}>RETRY DOSING</button>
              </div>
            )}
          </div>
        </div>

        <div className="side-panel">
          <div className="panel-box">
            <div className="panel-label">다음 · Next</div>
            <canvas ref={nextCanvasRef} width="120" height="80" style={{ display: 'block', margin: '0 auto' }}></canvas>
          </div>
          <div className="panel-box">
            <div className="panel-label">조작 · Controls</div>
            <div className="keys">
              <span>←→</span> 이동<br />
              <span>↑ / Z</span> 회전<br />
              <span>↓</span> 빠르게<br />
              <span>Space</span> 즉시 낙하<br />
              <span>P</span> 일시정지
            </div>
          </div>
          <div className="panel-box">
            <div className="panel-label">최고점 · Best</div>
            <div className="panel-value">{best}</div>
          </div>
        </div>
      </div>
    </>
  );
}