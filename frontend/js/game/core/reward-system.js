export function equippedRewardsBySlot(rewards = []) {
  return Object.fromEntries(rewards.map((reward) => [reward.slot, reward]));
}

/**
 * Translate equipped cosmetic/power rewards into initial runner state. Visual
 * construction stays with the explorer renderer so world art remains separate.
 */
export function initialRewardState(equipped) {
  const powerId = equipped.power?.reward_id;
  return {
    shieldCharges: powerId === "reward_magic_sparkle" ? 1 : 0,
    magnetTimer: powerId === "reward_coin_magnet" ? 12 : 0,
    doubleScoreTimer: powerId === "reward_focus_charm" ? 12 : 0,
  };
}
