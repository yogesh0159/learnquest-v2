const FREE_THINK_TIME_SECONDS = 5;
const EXTRA_THINK_TIME_COST_PER_SECOND = 10;

function completedPaidSeconds(elapsedMs) {
  return Math.max(0, Math.floor((Number(elapsedMs) - FREE_THINK_TIME_SECONDS * 1000) / 1000));
}

module.exports = { FREE_THINK_TIME_SECONDS, EXTRA_THINK_TIME_COST_PER_SECOND, completedPaidSeconds };
