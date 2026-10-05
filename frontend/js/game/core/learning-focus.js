export const FREE_THINK_TIME_SECONDS = 5;
export const EXTRA_THINK_TIME_COST_PER_SECOND = 10;

export function completedPaidSeconds(totalSeconds) {
  return Math.max(0, Math.floor(Number(totalSeconds) - FREE_THINK_TIME_SECONDS));
}

/** Renderer-independent Learning Focus clock shared by every runner world. */
export class LearningFocus {
  constructor({ onChange = () => {}, onCharge = async () => ({ afforded: true }), onReady = () => {} } = {}) {
    this.onChange = onChange;
    this.onCharge = onCharge;
    this.onReady = onReady;
    this.active = false;
    this.elapsed = 0;
    this.paidSeconds = 0;
    this.chargePending = false;
    this.balance = null;
    this.chargeRetryElapsed = 0;
  }

  start({ balance = null } = {}) {
    this.active = true;
    this.elapsed = 0;
    this.paidSeconds = 0;
    this.chargePending = false;
    this.balance = balance;
    this.chargeRetryElapsed = 0;
    this.notify();
  }

  tick(deltaSeconds) {
    if (!this.active) return false;
    const before = Math.floor(this.elapsed);
    this.elapsed += Math.max(0, Number(deltaSeconds) || 0);
    if (Math.floor(this.elapsed) !== before) this.notify();
    this.requestNextCharge();
    return true;
  }

  notify(message = null) {
    const freeRemaining = Math.max(0, Math.ceil(FREE_THINK_TIME_SECONDS - this.elapsed));
    this.onChange({ active: this.active, freeRemaining, paid: freeRemaining === 0, balance: this.balance, message });
  }

  requestNextCharge() {
    const completed = completedPaidSeconds(this.elapsed);
    if (!this.active || this.chargePending || this.elapsed < this.chargeRetryElapsed || completed <= this.paidSeconds) return;
    this.chargePending = true;
    Promise.resolve(this.onCharge(this.paidSeconds + 1)).then((result = {}) => {
      this.chargePending = false;
      if (!this.active) return;
      if (!result.afforded) {
        this.balance = result.balance ?? this.balance;
        this.finish("Time to choose!");
        return;
      }
      const confirmedPaidSeconds = Number(result.paidSeconds) || 0;
      this.chargeRetryElapsed = confirmedPaidSeconds > this.paidSeconds ? 0 : this.elapsed + .1;
      this.paidSeconds = Math.max(this.paidSeconds, confirmedPaidSeconds);
      this.balance = result.balance ?? this.balance;
      this.notify();
      if (!this.chargeRetryElapsed) this.requestNextCharge();
    }).catch(() => {
      this.chargePending = false;
      if (this.active) this.finish("Time to choose!");
    });
  }

  ready() {
    if (!this.active) return false;
    this.finish();
    return true;
  }

  finish(message = null) {
    if (!this.active) return;
    this.active = false;
    this.notify(message);
    this.onReady(message);
  }
}
