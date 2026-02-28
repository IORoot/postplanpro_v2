import type Database from 'better-sqlite3';

/**
 * Returns webhook IDs for a post. Uses post_webhook table; if empty, backfills from post.webhook_id and returns that.
 */
export function getWebhookIdsForPost(
	db: Database.Database,
	postId: string,
	postWebhookId: string | null
): string[] {
	const rows = db.prepare('SELECT webhook_id FROM post_webhook WHERE post_id = ? ORDER BY webhook_id').all(postId) as {
		webhook_id: string;
	}[];
	if (rows.length > 0) {
		return rows.map((r) => r.webhook_id);
	}
	if (postWebhookId) {
		db.prepare('INSERT OR IGNORE INTO post_webhook (post_id, webhook_id) VALUES (?, ?)').run(postId, postWebhookId);
		return [postWebhookId];
	}
	return [];
}

/**
 * Sets the webhooks for a post. Replaces all rows in post_webhook and sets post.webhook_id to the first ID.
 * Caller must validate that webhookIds is non-empty and all belong to account.
 */
export function setPostWebhooks(
	db: Database.Database,
	postId: string,
	accountId: string,
	webhookIds: string[]
): void {
	if (webhookIds.length === 0) return;
	db.prepare('DELETE FROM post_webhook WHERE post_id = ?').run(postId);
	const insert = db.prepare('INSERT INTO post_webhook (post_id, webhook_id) VALUES (?, ?)');
	for (const wid of webhookIds) {
		insert.run(postId, wid);
	}
	db.prepare("UPDATE post SET webhook_id = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?").run(
		webhookIds[0],
		postId,
		accountId
	);
}
