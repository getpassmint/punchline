// The café's card, shared by the server (field values, guarded updates) and
// the UI (the stamp row).

/** Slots on the card. */
export const STAMP_GOAL = 10

/** The tenth cup is free, so the reward lands on the ninth paid stamp. */
export const REWARD_AT = STAMP_GOAL - 1

export type CardState = 'active' | 'reward'
