/** Hide sample-data prefixes in labels while retaining the catalogue keys used in API requests. */
export const displayLabel = (value: string): string => value.replace(/^demo[\s_-]+/i, '');
