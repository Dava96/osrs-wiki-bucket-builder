/**
 * Type-level utilities for inferring the shape of bucket query responses.
 *
 * These types work in tandem with {@link BucketQueryBuilder} to provide
 * compile-time type safety for API responses. As you chain `.select()`,
 * `.join()`, and other methods, the builder accumulates a result type
 * that precisely describes the shape of each row returned by the API.
 *
 * @module response-types
 */

import type { BucketRegistry, BucketName } from './generated/definitions.js';

/**
 * Meta-fields that the query builder auto-injects into every select.
 *
 * These are not part of any bucket's schema. The query builder automatically
 * includes them in every generated Lua query so they are always returned in
 * the response. `page_name` identifies the source wiki page and
 * `page_name_sub` identifies the subpage or version variant.
 *
 * @example
 * ```typescript
 * // Every row in the response includes these:
 * // { "page_name": "Abyssal whip", "page_name_sub": "", "id": 4151, ... }
 * ```
 */
export interface BucketMetaFields {
    /** The wiki page that sourced this row. */
    page_name: string;
    /** The subpage or version variant (empty string if none). */
    page_name_sub: string;
}

/**
 * Computes the union of all valid field names for a given bucket and join map.
 *
 * This powers autocomplete in `.select()` and `.where()`. It includes:
 * - Direct fields from the main bucket (e.g. `'id'`, `'name'`)
 * - Dot-prefixed fields from joined buckets (e.g. `'exchange.value'`)
 * - The global wildcard `'*'` which selects all main bucket fields
 * - Alias wildcards like `'exchange.*'` which select all fields from a join
 *
 * @template TMain - The main bucket being queried.
 * @template TJoinMap - A record mapping alias names to their target bucket names.
 *
 * @example
 * ```typescript
 * // For bucket('infobox_item').join('exchange', 'ex', 'item_name', 'name'):
 * // ValidField = 'item_name' | 'weight' | ... | 'ex.id' | 'ex.name' | ... | '*' | 'ex.*'
 * ```
 */
export type ValidField<TMain extends BucketName, TJoinMap extends Record<string, BucketName>> =
    | (keyof BucketRegistry[TMain] & string)
    | JoinedFields<TJoinMap>
    | keyof BucketMetaFields
    | '*'
    | JoinedWildcards<TJoinMap>;

/**
 * Generates dot-prefixed field names for all joined buckets.
 * E.g. if TJoinMap = { ex: 'exchange' }, produces `'ex.id' | 'ex.name' | ...`
 */
type JoinedFields<TJoinMap extends Record<string, BucketName>> = {
    [A in keyof TJoinMap & string]: `${A}.${keyof BucketRegistry[TJoinMap[A]] & string}`;
}[keyof TJoinMap & string];

/**
 * Generates wildcard selectors for all joined buckets.
 * E.g. if TJoinMap = { ex: 'exchange' }, produces `'ex.*'`
 */
type JoinedWildcards<TJoinMap extends Record<string, BucketName>> = `${keyof TJoinMap & string}.*`;

/**
 * Resolves a single field string to its TypeScript type by delegating to
 * specialised helpers for each field format.
 *
 * The resolution strategy (in order):
 * 1. `'*'`          → Full main bucket type via {@link ResolveWildcard}
 * 2. `'alias.*'`    → All aliased fields via {@link ResolveAliasWildcard}
 * 3. `'alias.field'`→ Single joined field via {@link ResolveDottedField}
 * 4. `'field'`      → Single main bucket field via {@link ResolveMainField}
 *
 * Falls back to `unknown` for unrecognised fields.
 */
type ResolveField<
    TMain extends BucketName,
    TJoinMap extends Record<string, BucketName>,
    F extends string,
> = F extends '*'
    ? ResolveWildcard<TMain>
    : F extends `${infer Alias}.*`
      ? ResolveAliasWildcard<TJoinMap, Alias>
      : F extends `${infer Alias}.${infer Field}`
        ? ResolveDottedField<TJoinMap, Alias, Field>
        : ResolveMainField<TMain, F>;

/** Resolves `'*'` to the full main bucket interface. */
type ResolveWildcard<TMain extends BucketName> = BucketRegistry[TMain];

/**
 * Resolves `'alias.*'` to all fields from the aliased bucket,
 * with each key prefixed by the alias (e.g. `'ex.id'`, `'ex.name'`).
 */
type ResolveAliasWildcard<
    TJoinMap extends Record<string, BucketName>,
    Alias extends string,
> = Alias extends keyof TJoinMap
    ? { [K in keyof BucketRegistry[TJoinMap[Alias]] & string as `${Alias}.${K}`]: BucketRegistry[TJoinMap[Alias]][K] }
    : unknown;

/**
 * Resolves `'alias.field'` to the field's type from the joined bucket.
 * First checks if the alias is in the join map, then falls back to
 * checking if it's a raw bucket name (for unaliased joins).
 */
type ResolveDottedField<
    TJoinMap extends Record<string, BucketName>,
    Alias extends string,
    Field extends string,
> = Alias extends keyof TJoinMap
    ? LookupField<TJoinMap[Alias], Field>
    : Alias extends BucketName
      ? LookupField<Alias, Field>
      : unknown;

/** Resolves a plain field name to its type from the main bucket. */
type ResolveMainField<TMain extends BucketName, F extends string> = F extends keyof BucketRegistry[TMain]
    ? BucketRegistry[TMain][F]
    : unknown;

/** Looks up a field's type from a specific bucket, returning `unknown` if not found. */
type LookupField<B extends BucketName, F extends string> = F extends keyof BucketRegistry[B]
    ? BucketRegistry[B][F]
    : unknown;

/**
 * Builds the result object type from a set of selected field strings.
 *
 * This is the core type that powers the inferred response shape. It:
 * - Expands `'*'` to the full main bucket interface
 * - Expands `'alias.*'` to all prefixed fields from the joined bucket
 * - Maps plain and dotted fields to their resolved types
 *
 * @template TMain - The main bucket name.
 * @template TJoinMap - Record mapping join aliases to bucket names.
 * @template Fields - Union of selected field strings.
 *
 * @example
 * ```typescript
 * type R = SelectResult<'storeline', { exchange: 'exchange' }, 'sold_by' | 'exchange.value'>;
 * // { sold_by: string; 'exchange.value': number }
 * ```
 */
export type SelectResult<
    TMain extends BucketName,
    TJoinMap extends Record<string, BucketName>,
    Fields extends string,
> = ('*' extends Fields ? BucketRegistry[TMain] : object) &
    ExpandAliasWildcards<TMain, TJoinMap, Fields> & {
        [F in Fields as F extends '*' ? never : F extends `${string}.*` ? never : F]: ResolveField<TMain, TJoinMap, F>;
    };

/**
 * Expands alias wildcards (e.g. 'exchange.*') into their full prefixed field sets.
 * Uses UnionToIntersection to merge multiple wildcard expansions.
 */
type ExpandAliasWildcards<
    TMain extends BucketName,
    TJoinMap extends Record<string, BucketName>,
    Fields extends string,
> = UnionToIntersection<Fields extends `${infer A}.*` ? ResolveField<TMain, TJoinMap, `${A}.*`> : never>;

/** Converts a union type to an intersection type. */
type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

/**
 * Extracts the inferred result type from a `BucketQueryBuilder` instance.
 *
 * Use this with `typeof` to get the response row shape without executing the query:
 *
 * @example
 * ```typescript
 * const query = bucket('exchange').select('id', 'name', 'value');
 * type Row = InferBucketResult<typeof query>;
 * // Row = { id: number; name: string; value: number; page_name: string; page_name_sub: string }
 *
 * const raw = await fetch(query.toUrl()).then(r => r.json());
 * const response = new BucketResponse<Row>(raw);
 * response.first()?.name; // ✅ autocomplete, typed as string
 * ```
 */
export type InferBucketResult<T> = T extends { readonly __resultType: infer R } ? R : unknown;
