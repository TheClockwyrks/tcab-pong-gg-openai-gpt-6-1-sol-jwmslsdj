# Carom

A browser-only paddle duel about momentum and bank shots. Moving at contact puts
spin on the ball; two swaying, rotating obstacles turn a straight rally into a
battle of angles. Play against the computer in **Solo**, or share a keyboard in
**Versus**. First to 11 wins, with a two-point lead.

## Run

Requires a current Node.js release compatible with Vite 8.

```sh
npm ci
npm run dev
```

Open the local address printed by Vite. No backend, runtime downloads, assets,
accounts, or API keys are required.

## Production

```sh
npm run build
```

Serve `dist/` from the root of any static web host. `npm run preview` serves the
production build locally.

## Controls

| Control | Action |
| --- | --- |
| W / S | Left paddle |
| Up / Down | Right paddle in Versus; also left paddle in Solo |
| W / S or Up / Down | Select a menu item |
| Enter / Space | Confirm |
| P / Escape | Pause / resume |
| Escape | Back from instructions or match results |
| M | Toggle sound |
| Backtick | Engine diagnostics overlay |

Menus also support mouse and touch. On touch devices the engine provides two
vertical paddle sliders and menu controls. Strike near a paddle's tip to aim
steeply, and move during contact to curve the outgoing flight. Amber obstacles
reflect the ball without changing its speed or spin.

## Development

The Simple 2D engine owns the clock, input, audio, letterboxing, diagnostics, and
draw-command recording. Carom's immutable state and debug surface are exported
from `src/game.ts`; the render-free simulation is separated from canvas drawing.
Debug poses are applied with `engine.apply`, and readings use `engine.state`.
Nothing is installed on the browser's global object.

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

Tests run the actual engine with a Node canvas and counted clock steps. They
cover menus, serving, paddle integration, spin, collisions, goals, AI gates,
debug poses, and agreement between step sizes. The player-facing showcase,
screenshots, and an engine-recorded rally are in `showcase/`.
