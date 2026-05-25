/**
 * Feature flags. Currently a single source of truth — flip the constant and
 * recompile. No env wiring (we're not on a hosted environment yet). When the
 * flag is off, the corresponding section disappears from user-facing surfaces
 * (nav, onboarding nudges, curriculum links) but the routes themselves still
 * resolve so we can keep iterating internally.
 */

export const BUILD_ENABLED = false;
