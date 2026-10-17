import { CAROM_DEBUG_VERSION } from "./constants";
import type {
  BallState,
  Mode,
  Screen,
  Side,
  StateView,
  CaromState,
} from "./game";
import { initialState, obstacle, parked, drawSign } from "./world";
import { menuItemRect } from "./menus";

function ballPatch(s: StateView, patch: Partial<BallState>): CaromState {
  if (!s.ball) throw new Error("No ball on the field");
  return { ...s, ball: { ...s.ball, ...patch } };
}
export function createDebug() {
  return {
    version: CAROM_DEBUG_VERSION,
    clearWorld: (s: StateView): CaromState => ({
      ...s,
      ball: null,
      obstacles: [],
    }),
    spawnBall: (s: StateView): CaromState => ({ ...s, ball: parked() }),
    spawnObstacle(s: StateView, index: number): CaromState {
      const pose = obstacle(index, s.obstacleClock);
      return {
        ...s,
        obstacles: [...s.obstacles.filter((o) => o.index !== index), pose].sort(
          (a, b) => a.index - b.index,
        ),
      };
    },
    reset: (s: StateView) => initialState(s.muted),
    reconcile: (s: StateView): CaromState => ({
      ...s,
      obstacles: s.obstacles.map((o) => obstacle(o.index, s.obstacleClock)),
    }),
    setScreen: (s: StateView, screen: Screen): CaromState => ({ ...s, screen }),
    setMode: (s: StateView, mode: Mode): CaromState => ({ ...s, mode }),
    setMenuIndex: (s: StateView, menuIndex: number): CaromState => ({
      ...s,
      menuIndex,
    }),
    setTitleIndex: (s: StateView, titleIndex: number): CaromState => ({
      ...s,
      titleIndex,
    }),
    setResumeScreen: (
      s: StateView,
      resumeScreen: "playing" | "countdown",
    ): CaromState => ({ ...s, resumeScreen }),
    setScore: (s: StateView, p1: number, p2: number): CaromState => ({
      ...s,
      score: { p1, p2 },
    }),
    setWinner: (s: StateView, winner: Side | null): CaromState => ({
      ...s,
      winner,
    }),
    setReceiver: (s: StateView, receiver: Side): CaromState => ({
      ...s,
      receiver,
    }),
    setPaddleCy: (s: StateView, side: Side, cy: number): CaromState => ({
      ...s,
      paddles: { ...s.paddles, [side]: { ...s.paddles[side], cy } },
    }),
    setPaddleVy: (s: StateView, side: Side, drivenVy: number): CaromState => ({
      ...s,
      paddles: { ...s.paddles, [side]: { ...s.paddles[side], drivenVy } },
    }),
    setPaddleDriven: (
      s: StateView,
      side: Side,
      driven: boolean,
    ): CaromState => ({
      ...s,
      paddles: { ...s.paddles, [side]: { ...s.paddles[side], driven } },
    }),
    setBallPosition: (s: StateView, x: number, y: number) =>
      ballPatch(s, { x, y }),
    setBallVelocity: (s: StateView, vx: number, vy: number) =>
      ballPatch(s, { vx, vy }),
    setBallSpin: (s: StateView, spin: number) => ballPatch(s, { spin }),
    setBallHeld: (s: StateView, held: boolean) => ballPatch(s, { held }),
    setBallHoldTimer: (s: StateView, holdTimer: number) =>
      ballPatch(s, { holdTimer }),
    setBallServeSign: (s: StateView, serveSign: 1 | -1) =>
      ballPatch(s, { serveSign }),
    drawBallServeSign: (s: StateView) =>
      ballPatch(s, { serveSign: drawSign() }),
    setAiTracking: (s: StateView, tracking: boolean): CaromState => ({
      ...s,
      ai: { ...s.ai, tracking },
    }),
    setAiMovement: (s: StateView, movement: boolean): CaromState => ({
      ...s,
      ai: { ...s.ai, movement },
    }),
    setMuted: (s: StateView, muted: boolean): CaromState => ({ ...s, muted }),
    setObstacleClock: (s: StateView, obstacleClock: number): CaromState => ({
      ...s,
      obstacleClock,
      obstacles: s.obstacles.map((o) => obstacle(o.index, obstacleClock)),
    }),
    setObstacleClockRunning: (
      s: StateView,
      obstacleClockRunning: boolean,
    ): CaromState => ({ ...s, obstacleClockRunning }),
    snapshot: (s: StateView) => {
      const { menuPresses: _menuPresses, ...declared } = s;
      return {
        ...declared,
        version: CAROM_DEBUG_VERSION,
        ball: s.ball
          ? { ...s.ball, speed: Math.hypot(s.ball.vx, s.ball.vy) }
          : null,
      };
    },
    menuItemRect,
  };
}
