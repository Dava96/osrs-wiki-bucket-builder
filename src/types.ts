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
 * Helper class to manipulate/view the response.
 */
export class BucketResponse<T = unknown> {
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
