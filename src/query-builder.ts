import type { BucketName, BucketRegistry } from './generated/definitions.js';
import { BUCKET_FIELDS } from './generated/definitions.js';
import type { BucketMetaFields, SelectResult, ValidField } from './response-types.js';
import {
    Bucket,
    QUERY_DEFAULTS,
    type BucketCondition,
    type BucketHelperCondition,
    type Operator,
    type OrderByDirection,
    type ScalarValue,
} from './types.js';

/** Base URL for the OSRS Wiki Bucket API. */
const BUCKET_API_BASE = 'https://oldschool.runescape.wiki/api.php';

/**
 * A type-safe query builder for OSRS Wiki Buckets.
 *
 * Uses recursive generics to track joined buckets, available fields, and the
 * inferred result shape. As you chain `.select()`, `.join()`, and `.where()`,
 * the builder accumulates type information so you get full autocomplete on
 * field names and automatically inferred response types.
 *
 * @template TMain The name of the primary bucket.
 * @template TJoinMap A record mapping alias/bucket names to their target bucket names.
 * @template TSelected The accumulated result shape (defaults to the full bucket type).
 * @template THasSelected Whether `.select()` has been called (used to switch from
 *   full-type default to narrowed selection).
 *
 * @example
 * ```typescript
 * import { bucket, InferBucketResult } from '@dava96/osrs-wiki-bucket-builder';
 *
 * const query = bucket('exchange').select('id', 'name', 'value');
 * type Row = InferBucketResult<typeof query>;
 * // Row = { id: number; name: string; value: number; page_name: string; page_name_sub: string }
 * ```
 */
export class BucketQueryBuilder<
    TMain extends BucketName,
    TJoinMap extends Record<string, BucketName> = Record<string, never>,
    TSelected = BucketRegistry[TMain] & BucketMetaFields,
    THasSelected extends boolean = false,
> {
    /**
     * Type-level accessor for the inferred result shape.
     *
     * This property does not exist at runtime — it is a compile-time brand
     * used by {@link InferBucketResult} to extract the result type.
     */
    declare readonly __resultType: TSelected;

    private readonly mainBucket: TMain;
    private joins: Array<{ target: string; alias?: string; onSource: string; onTarget: string }> = [];
    private selections: string[] = [];
    private whereClauses: BucketCondition[] = [];
    private limitValue: number = QUERY_DEFAULTS.LIMIT;
    private offsetValue: number = QUERY_DEFAULTS.OFFSET;
    private orderClauses: Array<{ field: string; direction: OrderByDirection }> = [];
    private aliasMap: Record<string, string> = {};

    constructor(bucket: TMain) {
        this.mainBucket = bucket;
        this.aliasMap[bucket] = bucket;
    }

    /**
     * Selects fields to retrieve from the query results.
     *
     * Supports plain field names, dot notation for joined buckets
     * (e.g. `'exchange.value'`), and wildcards (`'*'`, `'exchange.*'`).
     *
     * Multiple `.select()` calls accumulate — they merge fields rather
     * than replacing previous selections.
     *
     * @param fields - One or more field names to include in the result.
     *   Your IDE will autocomplete valid field names based on the bucket
     *   and any active joins.
     *
     * @example
     * ```typescript
     * bucket('exchange').select('id', 'name');          // plain fields
     * bucket('exchange').select('*');                    // all fields
     * query.join('exchange', 'ex', 'item_name', 'name')
     *      .select('item_name', 'ex.value', 'ex.limit'); // joined fields
     * ```
     */
    select<F extends ValidField<TMain, TJoinMap>>(
        ...fields: F[]
    ): BucketQueryBuilder<
        TMain,
        TJoinMap,
        THasSelected extends true
            ? TSelected & SelectResult<TMain, TJoinMap, F>
            : SelectResult<TMain, TJoinMap, F> & BucketMetaFields,
        true
    > {
        this.selections.push(...fields);
        return this as unknown as BucketQueryBuilder<
            TMain,
            TJoinMap,
            THasSelected extends true
                ? TSelected & SelectResult<TMain, TJoinMap, F>
                : SelectResult<TMain, TJoinMap, F> & BucketMetaFields,
            true
        >;
    }

    /**
     * Joins another bucket to the query.
     *
     * The join is a LEFT JOIN — main bucket rows always appear, but joined
     * fields may be absent when there is no matching row in the target bucket
     * (e.g. untradeable items have no exchange entry).
     *
     * After joining, dot-notation fields like `'exchange.value'` become
     * available in `.select()` and `.where()`.
     *
     * @param targetBucket - The name of the bucket to join.
     * @param sourceField - The field in the current result set to join ON.
     * @param targetField - The field in the target bucket to join ON.
     *
     * @example
     * ```typescript
     * bucket('infobox_item')
     *   .join('exchange', 'item_name', 'name')
     *   .select('item_name', 'exchange.value');
     * ```
     */
    join<TTarget extends BucketName>(
        targetBucket: TTarget,
        sourceField: string,
        targetField: string,
    ): BucketQueryBuilder<TMain, TJoinMap & Record<TTarget, TTarget>, TSelected, THasSelected>;

    /**
     * Joins another bucket with an alias.
     *
     * Aliases let you give joined buckets shorter names for use in
     * `.select()` and `.where()`. The alias is resolved to the real
     * bucket name in the generated Lua query.
     *
     * @param targetBucket - The name of the bucket to join.
     * @param alias - An alias for this bucket to use in select/where.
     * @param sourceField - The field in the current result set to join ON.
     * @param targetField - The field in the target bucket to join ON.
     *
     * @example
     * ```typescript
     * bucket('infobox_item')
     *   .join('exchange', 'ex', 'item_name', 'name')
     *   .select('item_name', 'ex.value', 'ex.limit');
     * ```
     */
    join<TTarget extends BucketName, TAlias extends string>(
        targetBucket: TTarget,
        alias: TAlias,
        sourceField: string,
        targetField: string,
    ): BucketQueryBuilder<TMain, TJoinMap & Record<TAlias, TTarget>, TSelected, THasSelected>;

    join(
        targetBucket: BucketName,
        aliasOrSourceField: string,
        sourceOrTargetField: string,
        maybeTargetField?: string,
    ): BucketQueryBuilder<TMain, Record<string, BucketName>, TSelected, THasSelected> {
        let alias: string | undefined;
        let sourceField: string;
        let targetField: string;

        if (maybeTargetField) {
            alias = aliasOrSourceField;
            sourceField = sourceOrTargetField;
            targetField = maybeTargetField;
        } else {
            sourceField = aliasOrSourceField;
            targetField = sourceOrTargetField;
        }

        const joinEntry: { target: string; alias?: string; onSource: string; onTarget: string } = {
            target: targetBucket,
            onSource: sourceField,
            onTarget: targetField,
        };
        if (alias) {
            joinEntry.alias = alias;
        }

        this.joins.push(joinEntry);

        if (alias) {
            this.aliasMap[alias] = targetBucket;
        } else {
            this.aliasMap[targetBucket] = targetBucket;
        }

        return this as unknown as BucketQueryBuilder<TMain, Record<string, BucketName>, TSelected, THasSelected>;
    }

    /**
     * Filters results by field equality.
     *
     * @param field - The field to filter on. Supports autocomplete for valid field names.
     * @param value - The value to match (implies `=` operator).
     */
    where(field: ValidField<TMain, TJoinMap>, value: ScalarValue | BucketHelperCondition): this;

    /**
     * Filters results with an explicit operator.
     *
     * @param field - The field to filter on. Supports autocomplete for valid field names.
     * @param op - The comparison operator (`=`, `!=`, `>`, `<`, `>=`, `<=`).
     * @param value - The value to compare against.
     */
    where(field: ValidField<TMain, TJoinMap>, op: Operator, value: ScalarValue | BucketHelperCondition): this;

    /**
     * Adds multiple conditions (implicitly AND).
     *
     * @param conditions One or more conditions.
     */
    where(...conditions: BucketCondition[]): this;

    where(...args: (string | BucketCondition | Operator | ScalarValue | BucketHelperCondition)[]): this {
        const first = args[0];
        if (typeof first === 'string') {
            if (args.length === 2) {
                const val = args[1];
                if (typeof val === 'object' && val !== null && '_type' in val) {
                    this.whereClauses.push([args[0] as string, val as BucketHelperCondition]);
                } else {
                    this.whereClauses.push([args[0] as string, args[1] as ScalarValue]);
                }
            } else if (args.length === 3) {
                const val = args[2] as ScalarValue | BucketHelperCondition;
                if (typeof val === 'object' && val !== null && '_type' in val) {
                    this.whereClauses.push([args[0] as string, args[1] as Operator, val as BucketHelperCondition]);
                } else {
                    this.whereClauses.push([args[0] as string, args[1] as Operator, val as ScalarValue]);
                }
            } else {
                this.whereClauses.push({ _group: args as BucketCondition[] });
            }
        } else {
            this.whereClauses.push({ _group: args as BucketCondition[] });
        }
        return this;
    }

    /**
     * Shorthand for `where(field, '!=', value)`.
     *
     * @param field - The field to exclude matches on.
     * @param value - The value to exclude.
     */
    whereNot(field: ValidField<TMain, TJoinMap>, value: ScalarValue): this {
        return this.where(field, '!=', value);
    }

    /**
     * Filters for rows where field is NULL.
     *
     * @param field - The field to check for NULL.
     */
    whereNull(field: ValidField<TMain, TJoinMap>): this {
        return this.where(field, Bucket.Null());
    }

    /**
     * Filters for rows where field is NOT NULL.
     *
     * @param field - The field to check for NOT NULL.
     */
    whereNotNull(field: ValidField<TMain, TJoinMap>): this {
        return this.where(field, '!=', Bucket.Null());
    }

    /**
     * Filters for rows where field is between two values (inclusive).
     *
     * @param field - The field to filter on.
     * @param range - A tuple of `[min, max]` values (inclusive on both ends).
     */
    whereBetween(field: ValidField<TMain, TJoinMap>, range: [ScalarValue, ScalarValue]): this {
        return this.where(field, '>=', range[0]).where(field, '<=', range[1]);
    }

    /**
     * Conditionally applies a callback to the query.
     *
     * @param condition When true, the callback is executed.
     * @param callback Receives the builder for chaining.
     */
    when(condition: boolean, callback: (query: this) => void): this {
        if (condition) {
            callback(this);
        }
        return this;
    }

    /**
     * Filters for rows where field matches any of the given values.
     * Generates `Bucket.Or({field, v1}, {field, v2}, ...)` internally.
     *
     * @param field - The field to match against.
     * @param values - An array of values; rows matching any value are included.
     *
     * @example
     * ```typescript
     * bucket('exchange').whereIn('name', ['Bronze axe', 'Iron axe', 'Steel axe']);
     * ```
     */
    whereIn(field: ValidField<TMain, TJoinMap>, values: ScalarValue[]): this {
        const conditions = values.map((v) => [field, v] as BucketCondition);
        this.whereClauses.push(Bucket.Or(...conditions));
        return this;
    }

    /**
     * Sets the maximum number of rows to return.
     * Accepted range is 1–5000. Defaults to 500.
     *
     * @param limit The row limit.
     */
    limit(limit: number): this {
        if (!limit || limit <= 0) {
            this.limitValue = QUERY_DEFAULTS.LIMIT;
        } else if (limit > QUERY_DEFAULTS.MAX_LIMIT) {
            console.warn(`Limit ${limit} exceeds max ${QUERY_DEFAULTS.MAX_LIMIT}, clamping.`);
            this.limitValue = QUERY_DEFAULTS.MAX_LIMIT;
        } else {
            this.limitValue = limit;
        }
        return this;
    }

    /**
     * Sets the row offset for pagination.
     */
    offset(offset: number): this {
        this.offsetValue = offset;
        return this;
    }

    /**
     * Pagination helper that computes limit and offset from a page number.
     *
     * @param page 1-based page number.
     * @param perPage Items per page.
     */
    paginate(page: number, perPage: number): this {
        const p = page < 1 ? 1 : page;
        this.limit(perPage).offset((p - 1) * perPage);
        return this;
    }

    /**
     * Creates an independent deep copy of this query builder's state.
     *
     * Useful for building query variants from a shared base without
     * mutating the original.
     *
     * @example
     * ```typescript
     * const base = bucket('exchange').select('name', 'value').where('value', '>', 0);
     * const expensive = base.clone().orderBy('value', 'desc').limit(5);
     * const cheap = base.clone().orderBy('value', 'asc').limit(5);
     * ```
     */
    clone(): BucketQueryBuilder<TMain, TJoinMap, TSelected, THasSelected> {
        const clone = new BucketQueryBuilder<TMain, TJoinMap, TSelected, THasSelected>(this.mainBucket);
        clone.aliasMap = { ...this.aliasMap };
        clone.joins = [...this.joins];
        clone.selections = [...this.selections];
        clone.whereClauses = JSON.parse(JSON.stringify(this.whereClauses));
        clone.limitValue = this.limitValue;
        clone.offsetValue = this.offsetValue;
        clone.orderClauses = [...this.orderClauses];
        return clone;
    }

    /**
     * Orders results by a selected field.
     *
     * @param field Must be included in a prior `.select()` call.
     * @param direction `'asc'` or `'desc'`.
     */
    orderBy<K extends keyof TSelected>(field: K & string, direction: OrderByDirection): this {
        if (this.selections.length > 0) {
            const directMatch = this.selections.includes(field);
            let wildcardMatch = false;

            if (!directMatch) {
                for (const sel of this.selections) {
                    if (sel === '*') {
                        wildcardMatch = true;
                        break;
                    }
                    if (sel.endsWith('.*')) {
                        const alias = sel.split('.')[0];
                        if (field.startsWith(alias + '.')) {
                            wildcardMatch = true;
                            break;
                        }
                    }
                }
            }

            if (!directMatch && !wildcardMatch) {
                console.warn(
                    `Warning: orderBy field '${field}' is not explicitly selected. This may fail on the Wiki API.`,
                );
            }
        }

        this.orderClauses.push({ field, direction });
        return this;
    }

    /**
     * Convenience method that sets `limit(1)`.
     */
    first(): this {
        this.limit(1);
        return this;
    }

    /**
     * Resolves a dotted field reference (`alias.fieldName`) to its real bucket name.
     * Returns the field unchanged if the alias is not recognised.
     */
    private resolveAlias(field: string): string {
        if (!field.includes('.')) return field;
        const parts = field.split('.');
        if (parts.length < 2) return field;
        const alias = parts[0]!;
        const f = parts[1]!;
        const mapped = this.aliasMap[alias];
        return mapped ? `${mapped}.${f}` : field;
    }

    /**
     * Expands a field selector into a list of quoted Lua selectors.
     * Handles wildcards (`*`, `alias.*`) and alias resolution.
     */
    private expandField(field: string): string[] {
        if (field === '*') {
            const allFields: string[] = [];
            const mainFields = BUCKET_FIELDS[this.mainBucket] || [];
            allFields.push(...mainFields.map((f) => `'${f}'`));
            for (const j of this.joins) {
                const targetFields = BUCKET_FIELDS[j.target as BucketName] || [];
                allFields.push(...targetFields.map((f: string) => `'${j.target}.${f}'`));
            }
            if (allFields.length === 0) {
                return ["'*'"];
            }
            return allFields;
        }

        if (field.includes('.')) {
            const parts = field.split('.');
            if (parts.length >= 2) {
                const alias = parts[0]!;
                const subField = parts[1]!;
                const realBucket = this.aliasMap[alias];

                if (!realBucket) {
                    return [`'${field}'`];
                }

                if (subField === '*') {
                    const fields = BUCKET_FIELDS[realBucket as BucketName] || [];
                    return fields.map((f: string) => `'${realBucket}.${f}'`);
                } else {
                    return [`'${realBucket}.${subField}'`];
                }
            }
        }

        return [`'${field}'`];
    }

    /**
     * Generates the Lua query string for this query.
     */
    printSQL(): string {
        let sql = `bucket('${this.mainBucket}')`;

        for (const j of this.joins) {
            let src = this.resolveAlias(j.onSource);
            let targetVal = this.resolveAlias(j.onTarget);

            if (!src.includes('.')) {
                src = `${this.mainBucket}.${src}`;
            }
            if (!targetVal.includes('.')) {
                targetVal = `${j.target}.${targetVal}`;
            }

            sql += `.join('${j.target}', '${src}', '${targetVal}')`;
        }

        if (this.selections.length > 0) {
            const finalSelectors: string[] = [];
            for (const s of this.selections) {
                finalSelectors.push(...this.expandField(s));
            }
            if (finalSelectors.length > 0) {
                const unique = Array.from(new Set(finalSelectors));
                sql += `.select(${unique.join(', ')})`;
            }
        }

        if (this.whereClauses.length > 0) {
            const clauses = this.whereClauses.map((clause) => {
                if ('_group' in clause) {
                    return clause._group.map((g) => this.formatCondition(g)).join(', ');
                }
                return this.formatCondition(clause);
            });
            for (const c of clauses) {
                sql += `.where(${c})`;
            }
        }

        for (const o of this.orderClauses) {
            const field = this.resolveAlias(o.field);
            sql += `.orderBy('${field}', '${o.direction}')`;
        }

        if (this.limitValue !== QUERY_DEFAULTS.LIMIT) {
            sql += `.limit(${this.limitValue})`;
        }
        if (this.offsetValue !== QUERY_DEFAULTS.OFFSET) {
            sql += `.offset(${this.offsetValue})`;
        }

        sql += '.run()';
        return sql;
    }

    /**
     * Formats a single condition into its Lua representation.
     */
    private formatCondition(cond: BucketCondition): string {
        if (typeof cond === 'object' && !Array.isArray(cond) && '_type' in cond) {
            if (cond._type === 'AND' || cond._type === 'OR') {
                const args = (cond.conditions || []).map((c) => this.formatCondition(c)).join(', ');
                return `bucket.${cond._type === 'AND' ? 'And' : 'Or'}(${args})`;
            }
            if (cond._type === 'NOT') {
                return `bucket.Not(${this.formatCondition(cond.condition!)})`;
            }
            if (cond._type === 'NULL') {
                return `bucket.Null()`;
            }
        }

        if (Array.isArray(cond)) {
            let field = cond[0];
            if (typeof field === 'string') {
                field = this.resolveAlias(field);
            }

            if (cond.length === 2) {
                const valRaw = cond[1];
                if (typeof valRaw === 'object' && valRaw !== null && '_type' in valRaw && valRaw._type === 'NULL') {
                    return `{ '${field}', bucket.Null() }`;
                }
                const val = typeof valRaw === 'string' ? `'${valRaw}'` : valRaw;
                return `{ '${field}', ${val} }`;
            }
            if (cond.length === 3) {
                const valRaw = cond[2];
                if (typeof valRaw === 'object' && valRaw !== null && '_type' in valRaw) {
                    return `{ '${field}', '${cond[1]}', ${this.formatCondition(valRaw)} }`;
                }
                const val = typeof valRaw === 'string' ? `'${valRaw}'` : valRaw;
                return `{ '${field}', '${cond[1]}', ${val} }`;
            }
        }

        return JSON.stringify(cond);
    }

    /**
     * Executes the query and returns the Lua query string.
     *
     * @param options - Configuration options.
     * @param options.encodeURI - Whether to URI encode the output (default: true).
     *                            Set to `false` if you need the raw Lua string for debugging.
     *
     * @example
     * ```typescript
     * const encoded = bucket('exchange').select('name').run();                 // URL-encoded
     * const raw = bucket('exchange').select('name').run({ encodeURI: false }); // raw Lua
     * ```
     */
    run(options: { encodeURI?: boolean } = {}): string {
        const sql = this.printSQL();
        const shouldEncode = options.encodeURI ?? true;
        return shouldEncode ? encodeURIComponent(sql) : sql;
    }

    /**
     * Generates the full OSRS Wiki Bucket API URL, ready for `fetch()`.
     *
     * This is a convenience method that calls `.run()` internally and
     * wraps the result in the standard API URL template. The query is
     * always URI-encoded.
     *
     * @returns The complete API URL as a string.
     *
     * @example
     * ```typescript
     * const query = bucket('exchange').select('name', 'value').where('name', 'Abyssal whip');
     * const data = await fetch(query.toUrl()).then(r => r.json());
     * ```
     */
    toUrl(): string {
        const encodedQuery = this.run();
        return `${BUCKET_API_BASE}?action=bucket&format=json&query=${encodedQuery}`;
    }
}

/**
 * Creates a new query builder for the given bucket.
 *
 * This is the main entry point for building queries. The returned builder
 * provides autocomplete for field names and tracks the result type as you
 * chain methods.
 *
 * @param bucket - The name of the bucket to query.
 *
 * @example
 * ```typescript
 * import { bucket } from '@dava96/osrs-wiki-bucket-builder';
 *
 * const query = bucket('exchange')
 *   .select('id', 'name', 'value')
 *   .where('name', 'Abyssal whip')
 *   .run();
 * ```
 */
export function bucket<K extends BucketName>(bucket: K): BucketQueryBuilder<K> {
    return new BucketQueryBuilder(bucket);
}
