/** One day in the statistics month activity chart (local calendar date in user TZ). */
export type StatsDailyPoint = {
	date: string;
	sent: number;
	scheduled: number;
};
