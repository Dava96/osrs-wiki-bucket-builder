/**
 * Re-export generated types.
 */
export * from './generated/definitions.js';

export type ScalarValue = string | number | boolean;
export type Operator = '=' | '!=' | '>' | '<' | '>=' | '<=';
export type OrderByDirection = 'asc' | 'desc';

export const QUERY_DEFAULTS = {
    LIMIT: 500,
    MAX_LIMIT: 5000,
    OFFSET: 0,
};

export interface BucketLogic {
    _type: 'AND' | 'OR';
    conditions: BucketCondition[];
}

export interface BucketNot {
    _type: 'NOT';
    condition: BucketCondition;
}

export interface BucketNull {
    _type: 'NULL';
}

export type BucketHelperCondition = BucketLogic | BucketNot | BucketNull;

export type SimpleCondition =
    | [string, ScalarValue]
    | [string, Operator, ScalarValue]
    | [string, BucketHelperCondition]
    | [string, Operator, BucketHelperCondition];
export type BucketCondition = SimpleCondition | BucketHelperCondition | { _group: BucketCondition[] };

/**
 * Represents the global 'Bucket' helper object available in the Wiki Lua environment.
 * Used for constructing complex WHERE clauses.
 */
export const Bucket = {
    /**
     * Logical AND for multiple conditions.
     * @param conditions The conditions to combine.
     */
    And: (...conditions: BucketCondition[]): BucketHelperCondition => ({ _type: 'AND', conditions }),

    /**
     * Logical OR for multiple conditions.
     * @param conditions The conditions to combine.
     */
    Or: (...conditions: BucketCondition[]): BucketHelperCondition => ({ _type: 'OR', conditions }),

    /**
     * Logical NOT for a condition.
     * @param condition The condition to negate.
     */
    Not: (condition: BucketCondition): BucketHelperCondition => ({ _type: 'NOT', condition }),

    /**
     * Represents a NULL value.
     */
    Null: (): BucketHelperCondition => ({ _type: 'NULL' }),
};

/**
 * Wraps the raw JSON response from the Wiki API.
 */
export interface BucketApiResponse<T = unknown> {
    bucketQuery: string;
    bucket?: T[];
    error?: string;
}

/**
 * Helper class to manipulate and access bucket API response data.
 *
 * Can be instantiated directly with a generic type, or use the static
 * {@link BucketResponse.from} factory to automatically infer the type
 * from a query builder instance.
 *
 * @template T The expected shape of each result row.
 *
 * @example
 * ```typescript
 * // Option 1: Manual type parameter
 * const response = new BucketResponse<{ id: number; name: string }>(raw);
 *
 * // Option 2: Automatic inference via .from()
 * const query = bucket('exchange').select('id', 'name');
 * const response = BucketResponse.from(query, raw);
 * response.first()?.name; // ✅ typed as string
 * ```
 */
export class BucketResponse<T = unknown> {
    /**
     * Creates a typed `BucketResponse` by inferring the result type
     * from a `BucketQueryBuilder` instance.
     *
     * This eliminates the need to manually specify `InferBucketResult<typeof query>`
     * — the type flows automatically from the builder's accumulated generics.
     *
     * @param _query - The query builder instance (used only for type inference, not called at runtime).
     * @param raw - The raw JSON response from the Wiki API.
     *
     * @example
     * ```typescript
     * const query = bucket('exchange').select('name', 'value').where('name', 'Abyssal whip');
     * const raw = await fetch(query.toUrl()).then(r => r.json());
     * const response = BucketResponse.from(query, raw);
     * response.first()?.value; // ✅ typed as number
     * ```
     */
    static from<Q extends { readonly __resultType: unknown }>(
        _query: Q,
        raw: BucketApiResponse<Q['__resultType']>,
    ): BucketResponse<Q['__resultType']> {
        return new BucketResponse(raw);
    }

    constructor(private readonly raw: BucketApiResponse<T>) {}

    /**
     * The Lua query string returned by the API.
     */
    get query(): string {
        return this.raw.bucketQuery;
    }

    /**
     * The array of results.
     * Throws if the response contains an error.
     */
    get results(): T[] {
        if (this.raw.error) {
            throw new Error(`Bucket API Error: ${this.raw.error}`);
        }
        return this.raw.bucket ?? [];
    }

    /**
     * The error message, if any.
     */
    get error(): string | undefined {
        return this.raw.error;
    }

    /**
     * Returns the first result or undefined.
     */
    first(): T | undefined {
        return this.results[0];
    }
}
