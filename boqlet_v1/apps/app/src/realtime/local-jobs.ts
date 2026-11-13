/**
 * Jobs started in this tab that show their own progress and result (an export's toast): their
 * `job.succeeded` / `job.failed` notifications go to the bell without a second toast (F13).
 */
export const localJobs = new Set<string>();
