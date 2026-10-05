/** A small lifecycle owner for the shared update/render animation loop. */
export class GameLoop {
  constructor({
    clock,
    update,
    render,
    requestFrame = (callback) => globalThis.requestAnimationFrame(callback),
    cancelFrame = (id) => globalThis.cancelAnimationFrame(id),
  }) {
    this.clock = clock;
    this.update = update;
    this.render = render;
    this.requestFrame = requestFrame;
    this.cancelFrame = cancelFrame;
    this.frameId = null;
    this.active = false;
    this.tick = () => {
      if (!this.active) return;
      const rawDelta = this.clock.getDelta();
      const delta = Math.min(.035, rawDelta);
      this.update(delta, rawDelta);
      this.render(delta, rawDelta);
      this.frameId = this.requestFrame(this.tick);
    };
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.frameId = this.requestFrame(this.tick);
  }

  stop() {
    this.active = false;
    if (this.frameId !== null) this.cancelFrame(this.frameId);
    this.frameId = null;
  }
}
