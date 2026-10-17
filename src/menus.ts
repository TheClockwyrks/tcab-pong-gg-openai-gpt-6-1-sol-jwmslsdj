import type { UpdateApi } from "@clockwyrks/simple-2d";
import type { CaromState, StateView } from "./game";
import {
  ACTIONS,
  TITLE_ITEMS,
  PAUSE_ITEMS,
  MATCHOVER_ITEMS,
} from "./constants";
import { startMatch, toTitle } from "./world";

export function items(s: StateView): readonly string[] {
  switch (s.screen) {
    case "title":
      return TITLE_ITEMS;
    case "paused":
      return PAUSE_ITEMS;
    case "matchover":
      return MATCHOVER_ITEMS;
    case "howto":
      return ["BACK TO MENU"];
    default:
      return [];
  }
}
export function menuItemRect(s: StateView, index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= items(s).length)
    return null;
  const y =
    s.screen === "howto"
      ? 592
      : s.screen === "title"
        ? 366 + index * 68
        : 350 + index * 68;
  return { x: 460, y, w: 360, h: 56 };
}
function confirm(s: StateView): CaromState {
  if (s.screen === "title") {
    const next = { ...s, titleIndex: s.menuIndex };
    return s.menuIndex === 2
      ? { ...next, screen: "howto", menuIndex: 0 }
      : startMatch(next, s.menuIndex === 0 ? "solo" : "versus");
  }
  if (s.screen === "howto") return toTitle(s);
  if (s.screen === "paused") {
    if (s.menuIndex === 0) return { ...s, screen: s.resumeScreen };
    if (s.menuIndex === 1) return startMatch(s, s.mode);
    return toTitle(s);
  }
  return s.menuIndex === 0 ? startMatch(s, s.mode) : toTitle(s);
}
export function readInput(state: StateView, api: UpdateApi): CaromState {
  const edges = Object.fromEntries(
    ACTIONS.map((a) => [a, api.input.pressed(a)]),
  );
  const samples = api.input.pointerSamples();
  const contacts = api.input.pointerContacts();
  let s: CaromState = {
    ...state,
    muted: edges.mute ? !state.muted : state.muted,
  };
  if (s.screen === "playing" || s.screen === "countdown") {
    return edges.pause
      ? {
          ...s,
          resumeScreen: s.screen,
          screen: "paused",
          menuIndex: 0,
          menuPresses: {},
        }
      : s;
  }
  if (s.screen === "paused" && (edges.pause || edges.back))
    return { ...s, screen: s.resumeScreen, menuPresses: {} };
  if ((s.screen === "howto" || s.screen === "matchover") && edges.back)
    return toTitle(s);
  const count = items(s).length;
  const up = edges["p1-up"] || edges["p2-up"];
  const down = edges["p1-down"] || edges["p2-down"];
  if (up) s = { ...s, menuIndex: (s.menuIndex + count - 1) % count };
  else if (down) s = { ...s, menuIndex: (s.menuIndex + 1) % count };
  // Keyboard confirmation wins over all pointer activity on this frame.
  if (!up && !down && edges.confirm) return { ...confirm(s), menuPresses: {} };
  const hit = (x: number, y: number) => {
    for (let i = 0; i < count; i++) {
      const r = menuItemRect(s, i);
      if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)
        return i;
    }
    return -1;
  };
  const presses = { ...s.menuPresses };
  let activated = false;
  for (const p of samples) {
    if (p.button && p.button !== "primary") continue;
    const i = hit(p.x, p.y);
    if (i >= 0) s = { ...s, menuIndex: i };
    if (p.type === "down") presses[p.id] = i;
    if (p.type === "up") {
      if (i >= 0 && presses[p.id] === i) activated = true;
      delete presses[p.id];
    }
  }
  for (const p of contacts) {
    const i = hit(p.x, p.y);
    if (i >= 0) s = { ...s, menuIndex: i };
  }
  return activated
    ? { ...confirm(s), menuPresses: {} }
    : { ...s, menuPresses: presses };
}
