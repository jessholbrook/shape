/**
 * How long the free tier's anonymous daily call counters are kept. The
 * database job that deletes them uses the same number
 * (supabase/migrations/20261108000000_delete_teacher_and_counter_retention.sql);
 * a test keeps them equal, and /privacy shows it.
 */
export const USAGE_COUNTER_DAYS = 30;
