"use client";
import { useEffect, useRef } from "react";

export default function GridBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let mx = 0, my = 0;
    const P: { x: number; y: number; vx: number; vy: number; s: number; a: number }[] = [];
    const N = 60;

    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", (e) => { mx = e.clientX; my = e.clientY; });

    for (let i = 0; i < N; i++) {
      P.push({
        x: Math.random() * c.width, y: Math.random() * c.height,
        vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15,
        s: Math.random() * 1.5 + 0.3, a: Math.random() * 0.3 + 0.05,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);

      // Subtle grid
      ctx.strokeStyle = "rgba(79,79,241,0.015)";
      ctx.lineWidth = 0.5;
      for (let x = 0; x < c.width; x += 100) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, c.height); ctx.stroke();
      }
      for (let y = 0; y < c.height; y += 100) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(c.width, y); ctx.stroke();
      }

      for (const p of P) {
        const dx = mx - p.x, dy = my - p.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 200 && d > 0) { p.vx += (dx / d) * 0.003; p.vy += (dy / d) * 0.003; }
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.998; p.vy *= 0.998;
        if (p.x < 0) p.x = c.width; if (p.x > c.width) p.x = 0;
        if (p.y < 0) p.y = c.height; if (p.y > c.height) p.y = 0;

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s * 5);
        grad.addColorStop(0, `rgba(79,79,241,${p.a * 0.6})`);
        grad.addColorStop(1, "rgba(79,79,241,0)");
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s * 5, 0, Math.PI * 2);
        ctx.fillStyle = grad; ctx.fill();

        ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(79,79,241,${p.a})`; ctx.fill();
      }

      // Connections
      for (let i = 0; i < P.length; i++) {
        for (let j = i + 1; j < P.length; j++) {
          const dx = P[i].x - P[j].x, dy = P[i].y - P[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 120) {
            ctx.beginPath(); ctx.moveTo(P[i].x, P[i].y); ctx.lineTo(P[j].x, P[j].y);
            ctx.strokeStyle = `rgba(79,79,241,${0.04 * (1 - d / 120)})`;
            ctx.lineWidth = 0.5; ctx.stroke();
          }
        }
      }

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={ref} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}
