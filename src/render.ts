import type { RenderApi } from "@clockwyrks/simple-2d";
import type { StateView } from "./game";
import * as C from "./constants";
import { items, menuItemRect } from "./menus";

const P = {
  left: "#70f3cc",
  right: "#a59aff",
  obstacle: "#ffbd73",
  white: "#edf4fa",
  soft: "#8595a9",
  line: "#233242",
};
type Context = CanvasRenderingContext2D;
function text(
  ctx: Context,
  copy: string,
  x: number,
  y: number,
  size = 16,
  color = P.soft,
  align: CanvasTextAlign = "left",
  weight = 500,
) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${size > 40 ? "Arial, sans-serif" : "monospace"}`;
  ctx.textAlign = align;
  ctx.fillText(copy, x, y);
}
function line(
  ctx: Context,
  x: number,
  y: number,
  x1: number,
  y1: number,
  color = P.line,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}
function bar(
  ctx: Context,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  glow = 14,
) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(w, h) / 2);
  ctx.fill();
  ctx.restore();
}
function furniture(s: StateView, ctx: Context) {
  ctx.save();
  const gradient = ctx.createRadialGradient(
    C.FIELD_CX,
    C.FIELD_CY,
    50,
    C.FIELD_CX,
    C.FIELD_CY,
    720,
  );
  gradient.addColorStop(0, "#10202b");
  gradient.addColorStop(1, "#080f19");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
  ctx.fillStyle = "#24313c";
  for (let x = 96; x < C.FIELD_W; x += 32)
    for (let y = 104; y < C.FIELD_H - 60; y += 32) ctx.fillRect(x, y, 1, 1);
  line(ctx, 24, 18, C.FIELD_W - 24, 18);
  line(ctx, 24, C.FIELD_H - 18, C.FIELD_W - 24, C.FIELD_H - 18);
  ctx.setLineDash([5, 13]);
  line(ctx, C.NET_X, 108, C.NET_X, 626, "#31404c");
  ctx.setLineDash([]);
  ctx.strokeStyle = "#223440";
  ctx.beginPath();
  ctx.arc(C.FIELD_CX, C.FIELD_CY, 86, 0, Math.PI * 2);
  ctx.stroke();
  for (const o of s.obstacles) {
    ctx.save();
    ctx.translate(o.cx, o.cy);
    ctx.rotate(o.theta);
    bar(
      ctx,
      -C.OBSTACLE_HW,
      -C.OBSTACLE_HH,
      C.OBSTACLE_W,
      C.OBSTACLE_H,
      P.obstacle,
      12,
    );
    ctx.fillStyle = "#a56838";
    ctx.fillRect(-2, -18, 4, 36);
    ctx.restore();
  }
  bar(
    ctx,
    C.P1_X0,
    s.paddles.left.cy - C.PADDLE_HALF,
    C.PADDLE_W,
    C.PADDLE_H,
    P.left,
  );
  bar(
    ctx,
    C.P2_X0,
    s.paddles.right.cy - C.PADDLE_HALF,
    C.PADDLE_W,
    C.PADDLE_H,
    P.right,
  );
  if (s.ball) {
    const b = s.ball;
    ctx.lineCap = "round";
    for (let i = 1; i < b.trail.length; i++) {
      const a = b.trail[i - 1],
        p = b.trail[i];
      ctx.globalAlpha = (0.45 * i) / b.trail.length;
      ctx.lineWidth = 3 + (12 * i) / b.trail.length;
      ctx.strokeStyle = P.white;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = P.white;
    ctx.shadowColor = P.white;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(b.x, b.y, C.BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}
function menu(s: StateView, ctx: Context) {
  items(s).forEach((copy, i) => {
    const r = menuItemRect(s, i);
    if (!r) return;
    const selected = i === s.menuIndex;
    ctx.fillStyle = selected ? "#183c3b" : "#101d29";
    ctx.strokeStyle = selected ? P.left : "#293949";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 4);
    ctx.fill();
    ctx.stroke();
    if (selected) {
      ctx.fillStyle = P.left;
      ctx.fillRect(r.x, r.y + 12, 3, r.h - 24);
    }
    text(
      ctx,
      copy,
      r.x + 28,
      r.y + 35,
      18,
      selected ? P.left : P.soft,
      "left",
      700,
    );
    text(
      ctx,
      selected ? "→" : `0${i + 1}`,
      r.x + r.w - 24,
      r.y + 35,
      18,
      selected ? P.left : "#526477",
      "right",
    );
  });
}
function hud(s: StateView, ctx: Context) {
  text(ctx, "CAROM /", 32, 54, 18, P.white, "left", 700);
  text(ctx, s.mode === "solo" ? "SOLO DUEL" : "LOCAL VERSUS", 32, 77, 11);
  text(ctx, "PLAYER 01", 520, 48, 12, P.left, "right");
  text(ctx, s.mode === "solo" ? "COMPUTER" : "PLAYER 02", 760, 48, 12, P.right);
  text(ctx, String(s.score.p1), 520, 104, 52, P.left, "right", 700);
  text(ctx, String(s.score.p2), 760, 104, 52, P.right, "left", 700);
  text(
    ctx,
    `FIRST TO ${C.WIN_SCORE} · WIN BY ${C.WIN_LEAD}`,
    C.FIELD_CX,
    47,
    10,
    P.soft,
    "center",
  );
  text(ctx, "W / S", 32, 679, 12, P.left);
  text(
    ctx,
    s.mode === "solo" ? "AI" : "↑ / ↓",
    1248,
    679,
    12,
    P.right,
    "right",
  );
  text(
    ctx,
    "MOVE AT CONTACT TO ADD SPIN",
    C.FIELD_CX,
    675,
    11,
    P.soft,
    "center",
  );
}
export function render(s: StateView, api: RenderApi): void {
  const ctx = api.ctx;
  furniture(s, ctx);
  const title = s.screen === "title",
    howto = s.screen === "howto";
  if (!title && !howto) hud(s, ctx);
  if (title || howto || s.screen === "paused" || s.screen === "matchover") {
    ctx.fillStyle = title || howto ? "#080f19ed" : "#080f19d9";
    ctx.fillRect(100, 100, 1080, 548);
    if (title) {
      text(
        ctx,
        "THE ART OF THE BANK SHOT",
        C.FIELD_CX,
        160,
        12,
        P.left,
        "center",
      );
      ctx.save();
      ctx.translate(C.FIELD_CX, 0);
      ctx.transform(1, 0, -0.09, 1, 0, 0);
      text(ctx, C.TITLE_TEXT, 18, 284, 118, P.white, "center", 900);
      ctx.restore();
      text(
        ctx,
        "BEND THE RALLY. BREAK THE ANGLE.",
        C.FIELD_CX,
        320,
        14,
        P.soft,
        "center",
      );
      line(ctx, 575, 340, 705, 340, P.left);
      text(ctx, "01 / SOLO", 150, 493, 11, P.left);
      text(ctx, "Outplay the machine.", 150, 519, 13);
      text(ctx, "02 / VERSUS", 940, 493, 11, P.right);
      text(ctx, "Settle it side by side.", 940, 519, 13);
      text(
        ctx,
        "SPIN × MOMENTUM × INSTINCT",
        C.FIELD_CX,
        620,
        11,
        P.soft,
        "center",
      );
    } else if (howto) {
      text(ctx, "FIELD MANUAL / 01", C.FIELD_CX, 148, 12, P.left, "center");
      text(ctx, "PLAY THE ANGLES", C.FIELD_CX, 212, 48, P.white, "center", 800);
      const rows = [
        [
          "01  MOVE",
          "W / S moves left.  ↑ / ↓ moves right.",
          "In Solo, either pair controls your paddle.",
        ],
        [
          "02  CURVE",
          "Strike while moving to put spin on the ball.",
          "Down bends clockwise. Up bends counterclockwise.",
        ],
        [
          "03  CAROM",
          "Bank off the rotating amber obstacles.",
          `Pass your opponent. First to ${C.WIN_SCORE}, ahead by ${C.WIN_LEAD}.`,
        ],
      ];
      rows.forEach((r, i) => {
        const y = 278 + i * 96;
        text(ctx, r[0], 260, y, 14, P.left);
        text(ctx, r[1], 460, y, 15, P.white);
        text(ctx, r[2], 460, y + 26, 13);
        line(ctx, 260, y + 47, 1020, y + 47);
      });
      text(
        ctx,
        "P / ESC  PAUSE     M  MUTE",
        C.FIELD_CX,
        566,
        12,
        P.soft,
        "center",
      );
    } else {
      text(
        ctx,
        s.screen === "paused" ? "TAKE A BREATHER" : "DUEL COMPLETE",
        C.FIELD_CX,
        212,
        12,
        P.left,
        "center",
      );
      text(
        ctx,
        s.screen === "paused"
          ? "PAUSED"
          : `${s.winner === "left" ? "PLAYER 01" : s.mode === "solo" ? "COMPUTER" : "PLAYER 02"} WINS`,
        C.FIELD_CX,
        281,
        48,
        P.white,
        "center",
        800,
      );
      if (s.screen === "matchover")
        text(
          ctx,
          `${s.score.p1}  —  ${s.score.p2}`,
          C.FIELD_CX,
          320,
          22,
          P.soft,
          "center",
        );
    }
    menu(s, ctx);
    if (!howto)
      text(
        ctx,
        "↑ ↓ / W S   SELECT       ENTER   CONFIRM",
        C.FIELD_CX,
        659,
        11,
        P.soft,
        "center",
      );
  }
  if (s.screen === "countdown") {
    text(ctx, "GET READY", C.FIELD_CX, 294, 18, P.white, "center", 700);
    text(
      ctx,
      `SERVING ${s.receiver === "left" ? "←" : "→"}`,
      C.FIELD_CX,
      430,
      12,
      P.left,
      "center",
    );
  }
  text(
    ctx,
    s.muted ? "M  SOUND OFF" : "M  SOUND ON",
    1248,
    54,
    11,
    P.soft,
    "right",
  );
  if (!title && !howto)
    text(ctx, "P / ESC  PAUSE", 1248, 77, 11, P.soft, "right");
  if (title || howto) {
    text(ctx, "A PADDLE DUEL WITH A TWIST", 32, 54, 11);
    text(ctx, "CAROM / 001", 32, 680, 11);
  }
}
