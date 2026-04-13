export const ACCOUNT_BACKUP_FORMAT = 'postplanpro-account-backup' as const;
export const ACCOUNT_BACKUP_VERSION = 1 as const;
/** User must type this exact phrase to confirm destructive replace import. */
export const ACCOUNT_IMPORT_CONFIRM_PHRASE = 'REPLACE MY DATA' as const;

/** Typed confirmation for deleting all app data (posts, webhooks, etc.) without removing the user account. */
export const ACCOUNT_RESET_CONFIRM_PHRASE = 'DELETE ALL MY DATA' as const;
