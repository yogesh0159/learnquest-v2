export class MissionSystem {
  constructor({ apiClient, onRender, onFeedback, onComplete }) {
    this.api = apiClient;
    this.onRender = onRender;
    this.onFeedback = onFeedback;
    this.onComplete = onComplete;
    this.mission = null;
    this.sessionId = null;
    this.progress = null;
    this.busy = false;
  }

  async start(missionId) {
    const result = await this.api.missionStart(missionId);
    this.mission = result.mission;
    this.sessionId = result.sessionId;
    this.progress = result.progress;
    this.onRender(this.snapshot());
    return this.snapshot();
  }

  snapshot() {
    const stepIndex = Number(this.progress?.currentStep || 0);
    return { mission: this.mission, progress: this.progress, step: this.mission?.steps[stepIndex] || null, busy: this.busy };
  }

  async answer(answerId) {
    if (this.busy || !this.mission || !this.sessionId || !this.snapshot().step) return null;
    this.busy = true;
    this.onRender(this.snapshot());
    try {
      const result = await this.api.missionAnswer(this.mission.id, {
        sessionId: this.sessionId,
        stepIndex: this.progress.currentStep,
        answerId,
      });
      this.progress = result.progress;
      await this.onFeedback(result, this.snapshot());
      this.busy = false;
      if (result.completed) this.onComplete(result, this.snapshot());
      else this.onRender(this.snapshot());
      return result;
    } finally {
      this.busy = false;
    }
  }
}
