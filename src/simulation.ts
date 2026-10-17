import type { UpdateApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { CaromState, PaddleState, Side, StateView } from "./game";
import { readInput } from "./menus";
import { clamp, obstacle, parked } from "./world";
import { fly } from "./physics";

function move(
  s: StateView,
  side: Side,
  api: UpdateApi,
  dt: number,
): PaddleState {
  const p = s.paddles[side];
  let vy = 0;
  if (p.driven) vy = p.drivenVy;
  else if (side === "right" && s.mode === "solo") {
    let target = C.AI_HOME_Y,
      deadzone = C.AI_HOME_DEADZONE;
    if (s.ai.tracking && s.screen === "playing" && s.ball && s.ball.vx > 0) {
      target = s.ball.y - s.ball.vy * C.AI_REACT;
      deadzone = C.AI_DEADZONE;
    }
    const diff = target - p.cy;
    if (s.ai.movement && Math.abs(diff) > deadzone && dt > 0)
      vy = Math.sign(diff) * Math.min(C.AI_SPEED, Math.abs(diff) / dt);
  } else {
    const solo = s.mode === "solo",
      prefix = side === "left" ? "p1" : "p2";
    const up =
      api.input.value(`${prefix}-up`) || (solo && api.input.value("p2-up"));
    const down =
      api.input.value(`${prefix}-down`) || (solo && api.input.value("p2-down"));
    vy = (Number(Boolean(down)) - Number(Boolean(up))) * C.PADDLE_SPEED;
  }
  const raw = p.cy + vy * dt,
    cy = clamp(raw, C.PADDLE_MIN_CY, C.PADDLE_MAX_CY);
  if (raw !== cy && dt > 0) vy = (cy - p.cy) / dt;
  return { ...p, cy, vy };
}
export function update(
  state: StateView,
  api: UpdateApi,
  dt: number,
): CaromState {
  let s = readInput(state, api);
  api.audio.setMuted(s.muted);
  s = { ...s, muted: api.audio.muted(), simTime: state.simTime + dt };
  if (s.screen !== "countdown" && s.screen !== "playing") return s;
  s = {
    ...s,
    paddles: {
      left: move(s, "left", api, dt),
      right: move(s, "right", api, dt),
    },
  };
  const cues = new Set<C.CueName>();
  let ball = s.ball;
  let served = false;
  if (ball) {
    if (s.screen === "countdown") {
      const timer = ball.holdTimer - dt;
      ball = { ...ball, holdTimer: Math.max(0, timer) };
      if (timer <= 0) {
        ball = {
          ...ball,
          held: false,
          trail: [],
          vx:
            (s.receiver === "left" ? -1 : 1) *
            C.SERVE_SPEED *
            Math.cos(C.SERVE_ANGLE),
          vy: ball.serveSign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
        };
        s = { ...s, screen: "playing" };
        served = true;
      }
    } else if (!ball.held) ball = fly(ball, s, dt, cues);
    if (!served)
      ball = {
        ...ball,
        trail: [
          ...ball.trail.filter((p) => s.simTime - p.t <= C.TRAIL_TIME),
          { x: ball.x, y: ball.y, t: s.simTime },
        ],
      };
    s = { ...s, ball };
    if (
      s.screen === "playing" &&
      !served &&
      (ball.x - C.BALL_R > C.FIELD_W || ball.x + C.BALL_R < 0)
    ) {
      const left = ball.x - C.BALL_R > C.FIELD_W;
      const score = {
        p1: s.score.p1 + Number(left),
        p2: s.score.p2 + Number(!left),
      };
      const winner =
        score.p1 >= C.WIN_SCORE && score.p1 - score.p2 >= C.WIN_LEAD
          ? "left"
          : score.p2 >= C.WIN_SCORE && score.p2 - score.p1 >= C.WIN_LEAD
            ? "right"
            : null;
      s = {
        ...s,
        score,
        winner,
        ...(winner
          ? { screen: "matchover" as const, menuIndex: 0 }
          : {
              screen: "countdown" as const,
              ball: parked(),
              receiver: left ? ("right" as const) : ("left" as const),
            }),
      };
      cues.add(C.CUES.score);
    }
  }
  const clock = s.obstacleClock + (s.obstacleClockRunning ? dt : 0);
  s = {
    ...s,
    obstacleClock: clock,
    obstacles: s.obstacles.map((o) => obstacle(o.index, clock)),
  };
  for (const cue of cues) api.audio.play(cue);
  return s;
}
