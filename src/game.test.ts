import { afterEach, describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { ConstantClock, createEngine } from "@clockwyrks/simple-2d";
import { game, BACKGROUND } from "./game";
import * as C from "./constants";

const engines: ReturnType<typeof createEngine>[] = [];
afterEach(() => {
  for (const e of engines) e.destroy();
  engines.length = 0;
});
async function setup(ms = 8) {
  const events = new EventTarget();
  const canvas = createCanvas(
    C.FIELD_W,
    C.FIELD_H,
  ) as unknown as HTMLCanvasElement;
  const engine = createEngine({
    canvas,
    width: C.FIELD_W,
    height: C.FIELD_H,
    game,
    background: BACKGROUND,
    layout: C.LAYOUT,
    clock: new ConstantClock(ms),
    surface: {
      cssWidth: () => C.FIELD_W,
      cssHeight: () => C.FIELD_H,
      dpr: () => 1,
      events: () => events,
    },
  });
  engines.push(engine);
  await engine.initialize();
  const key = (code: string, down = true) =>
    events.dispatchEvent(
      Object.assign(new Event(down ? "keydown" : "keyup"), {
        code,
        repeat: false,
      }),
    );
  const tap = async (code: string) => {
    key(code);
    await engine.advance(1);
    key(code, false);
  };
  const pointer = (
    type: string,
    x: number,
    y: number,
    id = 1,
    device = "mouse",
  ) =>
    events.dispatchEvent(
      Object.assign(new Event(`pointer${type}`), {
        clientX: x,
        clientY: y,
        pointerId: id,
        pointerType: device,
        isPrimary: true,
        button: 0,
        buttons: type === "up" ? 0 : 1,
      }),
    );
  return { e: engine, d: engine.debug, key, tap, pointer };
}
async function flight(ms = 8) {
  const h = await setup(ms),
    { e, d } = h;
  e.apply((s) => d.clearWorld(s));
  e.apply((s) => d.spawnBall(s));
  e.apply((s) => d.setScreen(s, "playing"));
  e.apply((s) => d.setMode(s, "versus"));
  e.apply((s) => d.setBallHeld(s, false));
  return h;
}
describe("Carom engine integration", () => {
  it("initializes the exact world, diagnostic reads, and all menu screens render", async () => {
    const { e, d } = await setup();
    expect(d.snapshot(e.state).version).toBe(C.CAROM_DEBUG_VERSION);
    expect(e.state.ball?.held).toBe(true);
    expect(e.state.obstacles).toHaveLength(2);
    expect(e.diagnostics().every((r) => !r.error)).toBe(true);
    for (const screen of [
      "title",
      "howto",
      "paused",
      "matchover",
      "countdown",
      "playing",
    ] as const) {
      e.apply((s) => d.setScreen(s, screen));
      await e.advance(1);
    }
    expect(e.state.simTime).toBeCloseTo(0.048);
  });
  it("navigates, remembers title selection, pauses once on Escape, restarts, and quits", async () => {
    const { e, tap } = await setup();
    await tap("ArrowDown");
    await tap("Enter");
    expect(e.state.mode).toBe("versus");
    expect(e.state.screen).toBe("countdown");
    await tap("Escape");
    expect(e.state.screen).toBe("paused");
    const clock = e.state.obstacleClock;
    await e.advance(5);
    expect(e.state.obstacleClock).toBe(clock);
    await tap("Escape");
    expect(e.state.screen).toBe("countdown");
    await tap("KeyP");
    await tap("KeyS");
    await tap("Enter");
    expect(e.state.score.p1).toBe(0);
    await tap("KeyP");
    await tap("KeyW");
    await tap("Enter");
    expect(e.state.screen).toBe("title");
    expect(e.state.menuIndex).toBe(1);
    await tap("KeyS");
    await tap("Enter");
    expect(e.state.screen).toBe("howto");
    await tap("Escape");
    expect(e.state.titleIndex).toBe(2);
  });
  it("honors menu edge priorities and pointer/touch press-release regions", async () => {
    const { e, d, key, pointer } = await setup();
    key("KeyS");
    key("Enter");
    await e.advance(1);
    key("KeyS", false);
    key("Enter", false);
    expect(e.state.menuIndex).toBe(1);
    expect(e.state.screen).toBe("title");
    const r = d.menuItemRect(e.state, 2)!;
    pointer("down", r.x + 4, r.y + 4);
    await e.advance(1);
    pointer("up", 0, 0);
    await e.advance(1);
    expect(e.state.screen).toBe("title");
    pointer("down", r.x + 4, r.y + 4, 2, "touch");
    pointer("up", r.x + 4, r.y + 4, 2, "touch");
    await e.advance(1);
    expect(e.state.screen).toBe("howto");
    expect(d.menuItemRect(e.state, 1)).toBeNull();
  });
  it("serves only on elapsed hold, preserves sign, and moves during countdown", async () => {
    const { e, d, key, tap } = await setup(10);
    await tap("Enter");
    e.apply((s) => d.setBallServeSign(s, -1));
    key("KeyS");
    await e.advance(99);
    expect(e.state.screen).toBe("playing");
    expect(e.state.ball?.x).toBe(C.FIELD_CX);
    expect(e.state.ball?.vy).toBeLessThan(0);
    expect(e.state.ball?.serveSign).toBe(-1);
    expect(e.state.paddles.left.cy).toBe(C.PADDLE_MAX_CY);
    expect(e.state.paddles.left.vy).toBe(0);
    await e.advance(1);
    expect(e.state.ball!.x).toBeLessThan(C.FIELD_CX);
  });
  it("integrates debug drivers without conflating desired and actual velocity", async () => {
    const { e, d } = await flight();
    e.apply((s) => d.setPaddleVy(s, "left", C.PADDLE_SPEED));
    expect(e.state.paddles.left.vy).toBe(0);
    e.apply((s) => d.setPaddleDriven(s, "left", true));
    await e.advance(100);
    expect(e.state.paddles.left.cy).toBe(C.PADDLE_MAX_CY);
    expect(e.state.paddles.left.vy).toBe(0);
    expect(e.state.paddles.left.drivenVy).toBe(C.PADDLE_SPEED);
    const before = e.state;
    e.apply((s) => d.reconcile(s));
    expect(e.state).toEqual(before);
  });
  it("reflects walls with preserved speed/spin decay and coalesces cue events", async () => {
    const { e, d } = await flight();
    e.apply((s) => d.setBallPosition(s, 300, 12));
    e.apply((s) => d.setBallVelocity(s, 0, -C.SPEED_CAP));
    const cues: string[] = [];
    e.events.on("cue:played", (v) => cues.push(v.cue));
    await e.advance(1);
    expect(e.state.ball!.vy).toBe(C.SPEED_CAP);
    expect(cues).toEqual([C.CUES.wallBounce]);
  });
  it("accelerates paddle-face hits and adds integrated spin", async () => {
    const { e, d } = await flight();
    e.apply((s) => d.setPaddleDriven(s, "left", true));
    e.apply((s) => d.setPaddleVy(s, "left", 200));
    e.apply((s) => d.setBallPosition(s, C.P1_X1 + C.BALL_R + 1, C.FIELD_CY));
    e.apply((s) => d.setBallVelocity(s, -600, 0));
    await e.advance(1);
    expect(e.state.ball!.vx).toBeGreaterThan(0);
    expect(Math.hypot(e.state.ball!.vx, e.state.ball!.vy)).toBeCloseTo(
      600 * C.SPEED_MULT,
    );
    expect(e.state.ball!.spin).toBeGreaterThan(160);
  });
  it("end caps reflect without acceleration", async () => {
    const { e, d } = await flight();
    e.apply((s) =>
      d.setBallPosition(
        s,
        C.P1_X0 + 8,
        C.FIELD_CY - C.PADDLE_HALF - C.BALL_R - 1,
      ),
    );
    e.apply((s) => d.setBallVelocity(s, 0, 500));
    await e.advance(1);
    expect(e.state.ball!.vy).toBe(-500);
    expect(e.state.ball!.spin).toBe(0);
  });
  it("rotated obstacle faces preserve speed and reflect in local axes", async () => {
    const { e, d } = await flight();
    e.apply((s) => d.setObstacleClock(s, 0.75));
    e.apply((s) => d.setObstacleClockRunning(s, false));
    e.apply((s) => d.spawnObstacle(s, 0));
    const o = e.state.obstacles[0],
      nx = Math.cos(o.theta),
      ny = Math.sin(o.theta);
    e.apply((s) => d.setBallPosition(s, o.cx + nx * 22, o.cy + ny * 22));
    e.apply((s) => d.setBallVelocity(s, -nx * 600, -ny * 600));
    await e.advance(1);
    expect(e.state.ball!.vx * nx + e.state.ball!.vy * ny).toBeGreaterThan(590);
    expect(Math.hypot(e.state.ball!.vx, e.state.ball!.vy)).toBeCloseTo(600);
  });
  it("scores beyond the full goal, parks, and enforces win by two", async () => {
    const { e, d } = await flight();
    e.apply((s) => d.setScore(s, 10, 10));
    const point = async () => {
      e.apply((s) => d.setScreen(s, "playing"));
      e.apply((s) => d.setBallHeld(s, false));
      e.apply((s) => d.setBallPosition(s, C.FIELD_W + C.BALL_R + 1, 200));
      await e.advance(1);
    };
    await point();
    expect(e.state.score.p1).toBe(11);
    expect(e.state.screen).toBe("countdown");
    expect(e.state.receiver).toBe("right");
    expect(e.state.ball!.trail).toHaveLength(0);
    await point();
    expect(e.state.screen).toBe("matchover");
    expect(e.state.winner).toBe("left");
  });
  it("AI gates and Solo alternate controls act independently", async () => {
    const { e, d, key } = await flight();
    e.apply((s) => d.setMode(s, "solo"));
    e.apply((s) => d.setBallPosition(s, 900, 600));
    e.apply((s) => d.setBallVelocity(s, 400, 0));
    key("ArrowUp");
    await e.advance(1);
    expect(e.state.paddles.left.cy).toBeLessThan(C.FIELD_CY);
    expect(e.state.paddles.right.cy).toBeGreaterThan(C.FIELD_CY);
    e.apply((s) => d.setAiMovement(s, false));
    const cy = e.state.paddles.right.cy;
    await e.advance(2);
    expect(e.state.paddles.right.cy).toBe(cy);
    e.apply((s) => d.setAiMovement(s, true));
    e.apply((s) => d.setAiTracking(s, false));
    e.apply((s) => d.setPaddleCy(s, "right", 600));
    await e.advance(1);
    expect(e.state.paddles.right.vy).toBe(-C.AI_SPEED);
  });
  it("all poses work without advancing and absent entity writes fail loudly", async () => {
    const { e, d } = await setup();
    e.apply((s) => d.clearWorld(s));
    expect(() => d.setBallSpin(e.state, 1)).toThrow();
    expect(() => d.spawnObstacle(e.state, 2)).toThrow();
    await e.advance(1);
    e.apply((s) => d.spawnBall(s));
    e.apply((s) => d.setBallHoldTimer(s, 0.2));
    e.apply((s) => d.setBallSpin(s, 123));
    e.apply((s) => d.drawBallServeSign(s));
    e.apply((s) => d.setReceiver(s, "right"));
    e.apply((s) => d.setResumeScreen(s, "countdown"));
    e.apply((s) => d.setTitleIndex(s, 1));
    e.apply((s) => d.setMenuIndex(s, 2));
    e.apply((s) => d.setWinner(s, "right"));
    e.apply((s) => d.setMuted(s, true));
    await e.advance(1);
    expect(d.snapshot(e.state).ball!.spin).toBe(123);
    expect(e.state.muted).toBe(true);
    e.apply((s) => d.reset(s));
    expect(e.state.simTime).toBe(0);
    expect(e.state.muted).toBe(true);
  });
  it("curved flight agrees between 2ms and 16ms steps", async () => {
    const results = [];
    for (const ms of [2, 16]) {
      const { e, d } = await flight(ms);
      e.apply((s) => d.setBallPosition(s, 400, 200));
      e.apply((s) => d.setBallVelocity(s, 400, -280));
      e.apply((s) => d.setBallSpin(s, 500));
      await e.advance(800 / ms);
      results.push(e.state.ball!);
    }
    expect(Math.hypot(results[0].vx, results[0].vy)).toBeCloseTo(
      Math.hypot(results[1].vx, results[1].vy),
      6,
    );
    expect(Math.sign(results[0].vx)).toBe(Math.sign(results[1].vx));
    expect(Math.sign(results[0].vy)).toBe(Math.sign(results[1].vy));
    expect(results[0].spin).toBeCloseTo(results[1].spin, 6);
  });
});
