# OSRS Wiki Bucket Builder

A strictly typed, zero-dependency query builder for the [Old School RuneScape Wiki Bucket API](https://meta.weirdgloop.org/w/Extension:Bucket/Usage).

Generates valid Lua query strings that can be executed via the Wiki's `action=bucket` API endpoint, with full TypeScript type safety derived from the Wiki's own schema definitions.

## Features

- **Strict Typing** — TypeScript definitions generated from `Special:AllPages` ensure only valid bucket names and fields compile.
- **Fluent API** — Chain `.select()`, `.join()`, `.where()`, `.orderBy()`, `.limit()`, `.offset()`.
- **Join Aliases** — Multi-bucket joins with alias support and dot-notation (`shop.price`).
- **Wildcard Expansion** — Client-side `*` and `alias.*` expansion to strict field lists.
- **Zero Runtime Dependencies** — Generates query strings without making network requests.

## Installation

```bash
npm install @dava96/osrs-wiki-bucket-builder
```

## Quick Start

```typescript
import { bucket } from '@dava96/osrs-wiki-bucket-builder';

const query = bucket('exchange')
    .select('id', 'name', 'value')
    .where('name', 'Abyssal whip')
    .run();

// query is a URL-encoded Lua string, ready to use in a fetch call
const url = `https://oldschool.runescape.wiki/api.php?action=bucket&format=json&query=${query}`;
const response = await fetch(url);
const data = await response.json();
console.log(data.bucket); // [{ id: ..., name: 'Abyssal whip', value: ... }]
```

[▶ Run this query](https://oldschool.runescape.wiki/api.php?action=bucket&query=bucket(%27exchange%27).select(%27id%27,%20%27name%27,%20%27value%27).where({%20%27name%27,%20%27Abyssal%20whip%27%20}).run())

---

## Core Concepts

**What are Buckets?** Buckets are structured data tables exposed by the OSRS Wiki through the [Bucket extension](https://meta.weirdgloop.org/w/Extension:Bucket/Usage). Each bucket (e.g. `exchange`, `infobox_item`, `storeline`) contains rows and fields, similar to a SQL table.

**What does this library do?** This library provides a fluent TypeScript API that generates the Lua query strings the Wiki API expects. You chain methods like `.select()`, `.where()`, and `.join()`, and the builder outputs a correctly formatted Lua string. It never makes network requests — you handle fetching yourself.

**How does type safety work?** The `scripts/sync_buckets.ts` script fetches the schema of every bucket from the Wiki and generates TypeScript interfaces in `src/generated/definitions.ts`. This means your IDE will autocomplete bucket names and catch invalid field references at compile time.

---

## Guide

### Selecting Fields

Use `.select()` to pick which fields to retrieve. Without `.select()`, the API returns all fields.

```typescript
const query = bucket('exchange')
    .select('name', 'value', 'limit')
    .limit(5)
    .run();
```

[▶ Run this query](https://oldschool.runescape.wiki/api.php?action=bucket&query=bucket(%27exchange%27).select(%27name%27,%20%27value%27,%20%27limit%27).limit(5).run())

#### Wildcards

You can use `*` to select all fields from the main bucket, or `alias.*` from a joined bucket:

```typescript
// All fields from exchange
bucket('exchange').select('*').limit(5).run();

// All fields from a joined bucket
bucket('infobox_item')
    .join('exchange', 'item_name', 'name')
    .select('item_name', 'exchange.*')
    .limit(5)
    .run();
```

Wildcards are expanded client-side into explicit field lists using the generated schema.

---

### Filtering with Where

The `.where()` method filters results. It supports three calling styles:

#### Equality (implicit `=`)

```typescript
bucket('exchange')
    .select('name', 'value')
    .where('name', 'Dragon scimitar')
    .run();
```

[▶ Run this query](https://oldschool.runescape.wiki/api.php?action=bucket&query=bucket(%27exchange%27).select(%27name%27,%20%27value%27).where({%20%27name%27,%20%27Dragon%20scimitar%27%20}).run())

#### Comparison operators

Supported operators: `=`, `!=`, `>`, `<`, `>=`, `<=`

```typescript
bucket('exchange')
    .select('name', 'value')
    .where('value', '>', 1000000)
    .limit(10)
    .run();
```

[▶ Run this query](https://oldschool.runescape.wiki/api.php?action=bucket&query=bucket(%27exchange%27).select(%27name%27,%20%27value%27).where({%20%27value%27,%20%27%3E%27,%201000000%20}).limit(10).run())

#### Multiple conditions (implicit AND)

Chain `.where()` calls to combine conditions with AND:

```typescript
bucket('exchange')
    .select('name', 'value')
    .where('value', '>', 10000)
    .where('value', '<', 100000)
    .limit(10)
    .run();
```

---

### Convenience Filters

These shorthand methods simplify common filtering patterns:

#### `.whereNot(field, value)` — exclude matches

```typescript
bucket('exchange')
    .select('name', 'value')
    .whereNot('name', 'Coins')
    .where('value', '>', 0)
    .limit(10)
    .run();
```

[▶ Run this query](https://oldschool.runescape.wiki/api.php?action=bucket&query=bucket(%27exchange%27).select(%27name%27,%20%27value%27).where({%20%27name%27,%20%27!=%27,%20%27Coins%27%20}).where({%20%27value%27,%20%27%3E%27,%200%20}).limit(10).run())

#### `.whereNull(field)` / `.whereNotNull(field)` — null checks

```typescript
bucket('infobox_item')
    .select('item_name', 'weight')
    .whereNotNull('weight')
    .limit(10)
    .run();
```

[▶ Run this query](https://oldschool.runescape.wiki/api.php?action=bucket&query=bucket(%27infobox_item%27).select(%27item_name%27,%20%27weight%27).where({%20%27weight%27,%20%27!=%27,%20bucket.Null()%20}).limit(10).run())

#### `.whereBetween(field, [min, max])` — inclusive range

```typescript
bucket('exchange')
    .select('name', 'value')
    .whereBetween('value', [10000, 100000])
    .limit(10)
    .run();
```

[▶ Run this query](https://oldschool.runescape.wiki/api.php?action=bucket&query=bucket(%27exchange%27).select(%27name%27,%20%27value%27).where({%20%27value%27,%20%27%3E=%27,%2010000%20}).where({%20%27value%27,%20%27%3C=%27,%20100000%20}).limit(10).run())

#### `.whereIn(field, values)` — match any value

Generates `Bucket.Or()` internally:

```typescript
bucket('exchange')
    .select('name', 'value')
    .whereIn('name', ['Bronze axe', 'Iron axe', 'Steel axe'])
    .run();
```

[▶ Run this query](https://oldschool.runescape.wiki/api.php?action=bucket&query=bucket(%27exchange%27).select(%27name%27,%20%27value%27).where(bucket.Or({%20%27name%27,%20%27Bronze%20axe%27%20},%20{%20%27name%27,%20%27Iron%20axe%27%20},%20{%20%27name%27,%20%27Steel%20axe%27%20})).run())

---

### Combining Conditions

For more complex logic, use the `Bucket` helper object to construct AND, OR, and NOT conditions directly.

```typescript
import { bucket, Bucket } from '@dava96/osrs-wiki-bucket-builder';
```

#### `Bucket.Or(...)` — match any condition

```typescript
bucket('exchange')
    .select('name', 'value')
    .where(Bucket.Or(
        ['name', 'Bronze axe'],
        ['name', 'Iron axe'],
        ['name', 'Steel axe']
    ))
    .run();
```

#### `Bucket.And(...)` — all conditions must match

```typescript
bucket('exchange')
    .select('name', 'value')
    .where(Bucket.And(
        ['value', '>', 1000],
        ['value', '<', 50000]
    ))
    .run();
```

#### `Bucket.Not(...)` — negate a condition

```typescript
bucket('exchange')
    .select('name', 'value')
    .where(Bucket.Not(['name', 'Coins']))
    .run();
```

#### `Bucket.Null()` — represents a null value

```typescript
bucket('infobox_item')
    .select('item_name', 'weight')
    .where('weight', '!=', Bucket.Null())
    .run();
```

---

### Joining Buckets

Join two or more buckets to combine data from different sources. The join fields specify how rows match between buckets (like a SQL JOIN).

#### Basic join

```typescript
bucket('infobox_item')
    .join('exchange', 'item_name', 'name')
    .select('item_name', 'weight', 'exchange.value')
    .limit(5)
    .run();
```

[▶ Run this query](https://oldschool.runescape.wiki/api.php?action=bucket&query=bucket(%27infobox_item%27).join(%27exchange%27,%20%27infobox_item.item_name%27,%20%27exchange.name%27).select(%27item_name%27,%20%27weight%27,%20%27exchange.value%27).limit(5).run())

#### Join with alias

Use an alias to give joined buckets shorter names. Aliases are resolved to real bucket names in the generated Lua:

```typescript
bucket('infobox_item')
    .join('exchange', 'ex', 'item_name', 'name')
    .select('item_name', 'ex.value', 'ex.limit')
    .where('ex.value', '>', 100000)
    .limit(10)
    .run();
```

[▶ Run this query](https://oldschool.runescape.wiki/api.php?action=bucket&query=bucket(%27infobox_item%27).join(%27exchange%27,%20%27infobox_item.item_name%27,%20%27exchange.name%27).select(%27item_name%27,%20%27exchange.value%27,%20%27exchange.limit%27).where({%20%27exchange.value%27,%20%27%3E%27,%20100000%20}).limit(10).run())

#### Multiple joins

Join three buckets to combine item info, GE prices, and shop data:

```typescript
bucket('infobox_item')
    .join('exchange', 'item_name', 'name')
    .join('storeline', 'item_name', 'sold_item')
    .select(
        'item_name', 'weight',
        'exchange.value',
        'storeline.sold_by', 'storeline.store_sell_price'
    )
    .limit(5)
    .run();
```

[▶ Run this query](https://oldschool.runescape.wiki/api.php?action=bucket&query=bucket(%27infobox_item%27).join(%27exchange%27,%20%27infobox_item.item_name%27,%20%27exchange.name%27).join(%27storeline%27,%20%27infobox_item.item_name%27,%20%27storeline.sold_item%27).select(%27item_name%27,%20%27weight%27,%20%27exchange.value%27,%20%27storeline.sold_by%27,%20%27storeline.store_sell_price%27).limit(5).run())

---

### Ordering & Pagination

#### `.orderBy(field, direction)`

Sort by a selected field. The field must appear in a prior `.select()` call.

```typescript
bucket('exchange')
    .select('name', 'value')
    .orderBy('value', 'desc')
    .limit(10)
    .run();
```

#### `.paginate(page, perPage)`

A convenience helper that computes `.limit()` and `.offset()` from a 1-based page number:

```typescript
const page2 = bucket('exchange')
    .select('name', 'value')
    .where('value', '>', 0)
    .orderBy('value', 'desc')
    .paginate(2, 25)
    .run();
```

[▶ Run page 2](https://oldschool.runescape.wiki/api.php?action=bucket&query=bucket(%27exchange%27).select(%27name%27,%20%27value%27).where({%20%27value%27,%20%27%3E%27,%200%20}).orderBy(%27value%27,%20%27desc%27).limit(25).offset(25).run())

#### `.first()`

Shorthand for `.limit(1)` — grab just the top result:

```typescript
const top = bucket('exchange')
    .select('name', 'value')
    .orderBy('value', 'desc')
    .first()
    .run();
```

---

### Conditional Logic

#### `.when(condition, callback)`

Conditionally apply query modifications based on runtime values. The callback only executes when the condition is `true`:

```typescript
const isMembers = true;
const query = bucket('infobox_item')
    .select('item_name', 'value', 'members')
    .when(isMembers, (q) => q.where('members', true))
    .limit(10)
    .run();
```

---

### Reusing Queries

#### `.clone()`

Creates an independent deep copy of the builder. Changes to the clone don't affect the original:

```typescript
const base = bucket('exchange')
    .select('name', 'value')
    .where('value', '>', 0);

const topExpensive = base.clone().orderBy('value', 'desc').limit(5);
const topCheap = base.clone().orderBy('value', 'asc').limit(5);

const expensiveQuery = topExpensive.run();
const cheapQuery = topCheap.run();
```

---

## Executing Queries

### `.run()` — URL-encoded output (default)

By default, `.run()` returns a URI-encoded string, ready to concatenate into a URL:

```typescript
const query = bucket('exchange').select('name', 'value').run();
const url = `https://oldschool.runescape.wiki/api.php?action=bucket&format=json&query=${query}`;
```

### `.run({ encodeURI: false })` — raw Lua output

Pass `{ encodeURI: false }` to get the raw Lua string for debugging or logging:

```typescript
const lua = bucket('exchange').select('name', 'value').run({ encodeURI: false });
console.log(lua);
// bucket('exchange').select('name', 'value').run()
```

### `.printSQL()` — raw Lua string (alias)

Equivalent to `.run({ encodeURI: false })`, returns the raw Lua without encoding:

```typescript
const lua = bucket('exchange').select('name', 'value').printSQL();
```

### `BucketResponse` — response wrapper

The `BucketResponse` class wraps the raw API response and provides convenient accessors:

```typescript
import { bucket, BucketResponse } from '@dava96/osrs-wiki-bucket-builder';

const query = bucket('exchange')
    .select('name', 'value')
    .where('name', 'Abyssal whip')
    .first()
    .run();

const url = `https://oldschool.runescape.wiki/api.php?action=bucket&format=json&query=${query}`;
const raw = await fetch(url).then(r => r.json());
const response = new BucketResponse(raw);

console.log(response.results); // Array of matching rows
console.log(response.first()); // First result or undefined
console.log(response.query);   // The Lua query echoed by the API
console.log(response.error);   // Error message if the query failed
```

---

## Full Example

Multi-join with aliases, mixed conditions, ordering, and pagination — all in one query:

```typescript
import { bucket, Bucket } from '@dava96/osrs-wiki-bucket-builder';

const query = bucket('infobox_item')
    .join('exchange', 'ex', 'item_name', 'name')
    .join('storeline', 'shop', 'item_name', 'sold_item')
    .select(
        'item_name', 'weight',
        'ex.value', 'ex.limit',
        'shop.sold_by', 'shop.store_sell_price'
    )
    .where('ex.value', '>', 1000)
    .whereNotNull('shop.sold_by')
    .orderBy('ex.value', 'desc')
    .limit(10)
    .run();
```

[▶ Run this query](https://oldschool.runescape.wiki/api.php?action=bucket&query=bucket(%27infobox_item%27).join(%27exchange%27,%20%27infobox_item.item_name%27,%20%27exchange.name%27).join(%27storeline%27,%20%27infobox_item.item_name%27,%20%27storeline.sold_item%27).select(%27item_name%27,%20%27weight%27,%20%27exchange.value%27,%20%27exchange.limit%27,%20%27storeline.sold_by%27,%20%27storeline.store_sell_price%27).where({%20%27exchange.value%27,%20%27%3E%27,%201000%20}).where({%20%27storeline.sold_by%27,%20%27!=%27,%20bucket.Null()%20}).orderBy(%27exchange.value%27,%20%27desc%27).limit(10).run())

---

## API Reference

| Method | Description |
|---|---|
| `bucket(name)` | Creates a new query builder for the given bucket |
| `.select(...fields)` | Picks fields to retrieve. Supports dot-notation and wildcards |
| `.where(field, value)` | Filters by equality |
| `.where(field, op, value)` | Filters with a comparison operator |
| `.where(...conditions)` | Adds multiple conditions (implicit AND) |
| `.whereNot(field, value)` | Shorthand for `.where(field, '!=', value)` |
| `.whereNull(field)` | Filters for NULL values |
| `.whereNotNull(field)` | Filters for non-NULL values |
| `.whereBetween(field, [a, b])` | Inclusive range filter |
| `.whereIn(field, values)` | Matches any value from the list |
| `.join(bucket, sourceField, targetField)` | Joins another bucket |
| `.join(bucket, alias, sourceField, targetField)` | Joins with an alias |
| `.orderBy(field, direction)` | Sorts by `'asc'` or `'desc'` |
| `.limit(n)` | Sets max rows (1–5000, default 500) |
| `.offset(n)` | Sets row offset for pagination |
| `.paginate(page, perPage)` | Computes limit/offset from page number |
| `.first()` | Shorthand for `.limit(1)` |
| `.when(cond, fn)` | Conditionally applies `fn` when `cond` is true |
| `.clone()` | Deep copies the builder |
| `.run(options?)` | Returns the Lua query string (URI-encoded by default) |
| `.printSQL()` | Returns the raw Lua query string |

### Bucket Helpers

| Helper | Description |
|---|---|
| `Bucket.And(...conditions)` | Logical AND |
| `Bucket.Or(...conditions)` | Logical OR |
| `Bucket.Not(condition)` | Logical NOT |
| `Bucket.Null()` | Represents a NULL value |

### Type Exports

| Export | Purpose |
|---|---|
| `BucketName` | Union of all valid bucket names |
| `BucketRegistry` | Maps bucket names to their field interfaces |
| `BUCKET_FIELDS` | Runtime map of field names per bucket |
| `BucketResponse<T>` | Response wrapper class |
| `Operator` | Valid comparison operators |
| `ScalarValue` | `string \| number \| boolean` |

---

## Available Buckets

Browse all available buckets and their fields on the Wiki:
[Special:AllPages (Bucket namespace)](https://oldschool.runescape.wiki/w/Special:AllPages?from=&to=&namespace=9592)

## Resources

- [Bucket Extension: Usage Guide](https://meta.weirdgloop.org/w/Extension:Bucket/Usage)
- [Bucket Extension: API](https://meta.weirdgloop.org/w/Extension:Bucket/Api)
- [Bucket Extension: Example Modules](https://meta.weirdgloop.org/w/Extension:Bucket/Example_modules)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to set up the project, run tests, and submit changes.

## Development

### Setup
```bash
git clone https://github.com/Dava96/osrs-wiki-bucket-builder.git
cd osrs-wiki-bucket-builder
npm install
```

### Testing
```bash
npm test
```

### Linting & Formatting
```bash
npm run lint
npm run format
```

### Syncing Bucket Definitions
Regenerate TypeScript definitions from the Wiki:
```bash
npm run buckets
```

## License

ISC
