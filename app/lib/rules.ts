// The card's rules, shared by the server and the UI.

/** Slots on the card. */
export const STAMP_GOAL = 10

/** The tenth cup is free, so the reward lands on the ninth punch. */
export const REWARD_AT = STAMP_GOAL - 1

export type CardState = 'active' | 'reward'
