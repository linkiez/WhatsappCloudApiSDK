/**
 * Valid JSON primitive values.
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * A JSON-serializable value.
 */
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

/**
 * A JSON object (plain record).
 */
export type JsonObject = { [key: string]: JsonValue };

/**
 * A JSON array.
 */
export type JsonArray = JsonValue[];

/**
 * Checks whether a JSON value is an object (non-null and not an array).
 *
 * @param value - The value to inspect
 * @returns True when the value is a JSON object
 */
export function isJsonObject(value: JsonValue | undefined): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Checks whether a JSON value is an array.
 *
 * @param value - The value to inspect
 * @returns True when the value is a JSON array
 */
export function isJsonArray(value: JsonValue | undefined): value is JsonArray {
	return Array.isArray(value);
}
