const DEFAULT_SWIPE_THRESHOLD = 32;

/**
 * Owns runner input listeners so worlds only provide gameplay actions. The
 * controller deliberately does not know about lanes, player state, or UI
 * overlays; those remain in the runner lifecycle.
 */
export class InputController {
  constructor({
    canvas,
    buttons,
    actions,
    swipeThreshold = DEFAULT_SWIPE_THRESHOLD,
    eventTarget = window,
    documentTarget = document,
  }) {
    this.canvas = canvas;
    this.buttons = buttons;
    this.actions = actions;
    this.swipeThreshold = swipeThreshold;
    this.eventTarget = eventTarget;
    this.documentTarget = documentTarget;
    this.swipeStart = null;
    this.listeners = [];
  }

  listen(target, type, handler, options) {
    if (!target) return;
    target.addEventListener(type, handler, options);
    this.listeners.push(() => target.removeEventListener(type, handler, options));
  }

  bindButton(element, action) {
    this.listen(element, "pointerdown", (event) => {
      event.preventDefault();
      action();
    });
  }

  bind() {
    this.bindButton(this.buttons.left, () => this.actions.moveLane(-1));
    this.bindButton(this.buttons.right, () => this.actions.moveLane(1));
    this.bindButton(this.buttons.jump, this.actions.jump);
    this.bindButton(this.buttons.slide, this.actions.slide);

    this.listen(this.eventTarget, "keydown", (event) => {
      if (event.repeat) return;
      if (event.key === "Enter" && this.actions.ready?.()) {
        event.preventDefault();
        return;
      }
      if (["ArrowLeft", "a", "A"].includes(event.key)) this.actions.moveLane(-1);
      else if (["ArrowRight", "d", "D"].includes(event.key)) this.actions.moveLane(1);
      else if (["ArrowUp", "w", "W", " "].includes(event.key)) {
        event.preventDefault();
        this.actions.jump();
      } else if (["ArrowDown", "s", "S"].includes(event.key)) {
        event.preventDefault();
        this.actions.slide();
      } else if (["p", "P", "Escape"].includes(event.key)) this.actions.togglePause();
    });

    this.listen(this.canvas, "pointerdown", (event) => {
      this.swipeStart = { x: event.clientX, y: event.clientY };
    });
    this.listen(this.canvas, "pointerup", (event) => {
      if (!this.swipeStart) return;
      const dx = event.clientX - this.swipeStart.x;
      const dy = event.clientY - this.swipeStart.y;
      this.swipeStart = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < this.swipeThreshold) return;
      if (Math.abs(dx) > Math.abs(dy)) this.actions.moveLane(dx > 0 ? 1 : -1);
      else if (dy < 0) this.actions.jump();
      else this.actions.slide();
    });

    this.listen(this.documentTarget, "visibilitychange", () => {
      if (this.documentTarget.hidden) this.actions.pauseWhenHidden();
    });
  }

  dispose() {
    this.listeners.splice(0).forEach((remove) => remove());
    this.swipeStart = null;
  }
}
