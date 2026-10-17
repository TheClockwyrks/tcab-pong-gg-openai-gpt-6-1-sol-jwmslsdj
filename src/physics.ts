import * as C from "./constants";
import type { BallState, StateView, Side, ObstacleState } from "./game";
import { clamp } from "./world";

type MovingBall = { -readonly [K in keyof BallState]: BallState[K] };

function paddle(b: MovingBall, s: StateView, side: Side, cues: Set<C.CueName>) {
  const p = s.paddles[side];
  const x0 = side === "left" ? C.P1_X0 : C.P2_X0;
  const x1 = side === "left" ? C.P1_X1 : C.P2_X1;
  const y0 = p.cy - C.PADDLE_HALF,
    y1 = p.cy + C.PADDLE_HALF;
  const depths = [
    b.x - (x0 - C.BALL_R),
    x1 + C.BALL_R - b.x,
    b.y - (y0 - C.BALL_R),
    y1 + C.BALL_R - b.y,
  ];
  if (depths.some((d) => d <= 0)) return;
  const face = depths.indexOf(Math.min(...depths));
  if (face >= 2) {
    b.y = face === 2 ? y0 - C.BALL_R : y1 + C.BALL_R;
    if ((face === 2 && b.vy > 0) || (face === 3 && b.vy < 0)) {
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    }
    return;
  }
  b.x = face === 0 ? x0 - C.BALL_R : x1 + C.BALL_R;
  if (!((face === 0 && b.vx > 0) || (face === 1 && b.vx < 0))) return;
  const angle = clamp((b.y - p.cy) / C.PADDLE_HALF, -1, 1) * C.MAX_BOUNCE_ANGLE;
  const speed = Math.min(Math.hypot(b.vx, b.vy) * C.SPEED_MULT, C.SPEED_CAP);
  b.vx = (side === "left" ? 1 : -1) * speed * Math.cos(angle);
  b.vy = speed * Math.sin(angle);
  b.spin = clamp(
    b.spin + p.vy * C.SPIN_FROM_PADDLE,
    -C.SPIN_CLAMP,
    C.SPIN_CLAMP,
  );
  b.x = side === "left" ? C.P1_X1 + C.BALL_R : C.P2_X0 - C.BALL_R;
  cues.add(C.CUES.paddleHit);
}
function obstacleCollision(
  b: MovingBall,
  o: ObstacleState,
  cues: Set<C.CueName>,
) {
  const c = Math.cos(o.theta),
    s = Math.sin(o.theta);
  const dx = b.x - o.cx,
    dy = b.y - o.cy;
  const lx = dx * c + dy * s,
    ly = -dx * s + dy * c;
  const qx = clamp(lx, -C.OBSTACLE_HW, C.OBSTACLE_HW),
    qy = clamp(ly, -C.OBSTACLE_HH, C.OBSTACLE_HH);
  const dist = Math.hypot(lx - qx, ly - qy);
  if (dist >= C.BALL_R) return;
  let nx: number, ny: number, push: number;
  if (dist > 0) {
    nx = (lx - qx) / dist;
    ny = (ly - qy) / dist;
    push = C.BALL_R - dist;
  } else {
    const px = C.OBSTACLE_HW - Math.abs(lx),
      py = C.OBSTACLE_HH - Math.abs(ly);
    nx = px <= py ? (lx >= 0 ? 1 : -1) : 0;
    ny = px <= py ? 0 : ly >= 0 ? 1 : -1;
    push = C.BALL_R + Math.min(px, py);
  }
  const wx = nx * c - ny * s,
    wy = nx * s + ny * c;
  const dot = b.vx * wx + b.vy * wy;
  if (dot < 0) {
    b.vx -= 2 * dot * wx;
    b.vy -= 2 * dot * wy;
    cues.add(C.CUES.obstacleBounce);
  }
  b.x += wx * push;
  b.y += wy * push;
}
/** Pure render-free flight integration; event names are deduplicated per frame. */
export function fly(
  ball: BallState,
  state: StateView,
  dt: number,
  cues: Set<C.CueName>,
): BallState {
  const b: MovingBall = { ...ball };
  const n = Math.max(
      1,
      Math.ceil((Math.hypot(b.vx, b.vy) * dt) / C.MAX_SUBSTEP),
    ),
    h = dt / n;
  for (let i = 0; i < n; i++) {
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 0) {
      const a = (b.spin / speed) * h,
        c = Math.cos(a),
        s = Math.sin(a),
        vx = b.vx;
      b.vx = vx * c - b.vy * s;
      b.vy = vx * s + b.vy * c;
    }
    b.spin *= Math.pow(0.5, h / C.SPIN_HALFLIFE);
    b.x += b.vx * h;
    b.y += b.vy * h;
    if (b.y - C.BALL_R < 0 && b.vy < 0) {
      b.y = C.BALL_R;
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    } else if (b.y + C.BALL_R > C.FIELD_H && b.vy > 0) {
      b.y = C.FIELD_H - C.BALL_R;
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    }
    paddle(b, state, "left", cues);
    paddle(b, state, "right", cues);
    for (const o of state.obstacles) obstacleCollision(b, o, cues);
  }
  return b;
}
