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
npm install osrs-wiki-bucket-builder
```

## Quick Start

```typescript
import { bucket } from 'osrs-wiki-bucket-builder';

const query = bucket('exchange')
    .select('id', 'name', 'value')
    .where('name', 'Abyssal whip')
    .run();
```

Generated Lua:

```lua
bucket('exchange').select('id', 'name', 'value').where({ 'name', 'Abyssal whip' }).run()
```

[▶ Run this query](https://oldschool.runescape.wiki/api.php?action=bucket&query=bucket(%27exchange%27).select(%27id%27,%20%27name%27,%20%27value%27).where({%20%27name%27,%20%27Abyssal%20whip%27%20}).run())

## Fetching Data

The generated query string is **URL encoded by default**, so you can pass it directly to the API.

```typescript
const queryStr = bucket('exchange')
    .select('id', 'name', 'value')
    .where('name', 'Abyssal whip')
    .run(); // Returns encoded string like "bucket('exchange')..."

const wikiUrl = `https://oldschool.runescape.wiki/api.php?action=bucket&format=json&query=${queryStr}`;

const response = await fetch(wikiUrl);
const data = await response.json();
console.log(data);
```

> **Note:** If you need the raw Lua string for debugging, pass `{ encodeURI: false }` to `.run()`.

---

## Examples

### 1. Basic Select

Select a few fields from the `exchange` bucket.

```typescript
const query = bucket('exchange')
    .select('name', 'value', 'limit')
    .limit(5)
    .run();
```

```lua
bucket('exchange').select('name', 'value', 'limit').limit(5).run()
```

[▶ Run this query](https://oldschool.runescape.wiki/api.php?action=bucket&query=bucket(%27exchange%27).select(%27name%27,%20%27value%27,%20%27limit%27).limit(5).run())

### 2. Filtering with Where

Filter for a specific item by name.

```typescript
const query = bucket('exchange')
    .select('name', 'value')
    .where('name', 'Dragon scimitar')
    .run();
```

[▶ Run this query](https://oldschool.runescape.wiki/api.php?action=bucket&query=bucket(%27exchange%27).select(%27name%27,%20%27value%27).where({%20%27name%27,%20%27Dragon%20scimitar%27%20}).run())

### 3. Operators

Use comparison operators to filter numeric values.

```typescript
const query = bucket('exchange')
    .select('name', 'value')
    .where('value', '>', 1000000)
    .limit(10)
    .run();
```

[▶ Run this query](https://oldschool.runescape.wiki/api.php?action=bucket&query=bucket(%27exchange%27).select(%27name%27,%20%27value%27).where({%20%27value%27,%20%27%3E%27,%201000000%20}).limit(10).run())

### 4. Null Checks

Filter for rows where a field is or isn't null. Use the `.whereNull()` and `.whereNotNull()` convenience helpers:

```typescript
import { bucket } from 'osrs-wiki-bucket-builder';

const query = bucket('infobox_item')
    .select('item_name', 'weight')
    .whereNotNull('weight')
    .limit(10)
    .run();
```

[▶ Run this query](https://oldschool.runescape.wiki/api.php?action=bucket&query=bucket(%27infobox_item%27).select(%27item_name%27,%20%27weight%27).where({%20%27weight%27,%20%27!=%27,%20bucket.Null()%20}).limit(10).run())

### 5. Multiple Conditions with whereBetween

Chain `.where()` calls for implicit AND. Use `.whereBetween()` for range queries:

```typescript
const query = bucket('exchange')
    .select('name', 'value')
    .whereBetween('value', [10000, 100000])
    .limit(10)
    .run();
```

[▶ Run this query](https://oldschool.runescape.wiki/api.php?action=bucket&query=bucket(%27exchange%27).select(%27name%27,%20%27value%27).where({%20%27value%27,%20%27%3E=%27,%2010000%20}).where({%20%27value%27,%20%27%3C=%27,%20100000%20}).limit(10).run())

### 6. OR Conditions with whereIn

Use `.whereIn()` to match any value from a list (generates `Bucket.Or()` internally):

```typescript
const query = bucket('exchange')
    .select('name', 'value')
    .whereIn('name', ['Bronze axe', 'Iron axe', 'Steel axe'])
    .run();
```

[▶ Run this query](https://oldschool.runescape.wiki/api.php?action=bucket&query=bucket(%27exchange%27).select(%27name%27,%20%27value%27).where(bucket.Or({%20%27name%27,%20%27Bronze%20axe%27%20},%20{%20%27name%27,%20%27Iron%20axe%27%20},%20{%20%27name%27,%20%27Steel%20axe%27%20})).run())

Or use `Bucket.Or()` explicitly for more control:

```typescript
import { bucket, Bucket } from 'osrs-wiki-bucket-builder';

const query = bucket('exchange')
    .select('name', 'value')
    .where(Bucket.Or(['name', 'Bronze axe'], ['name', 'Iron axe'], ['name', 'Steel axe']))
    .run();
```

### 7. whereNot

Exclude specific values using `.whereNot()`:

```typescript
const query = bucket('exchange')
    .select('name', 'value')
    .whereNot('name', 'Coins')
    .where('value', '>', 0)
    .limit(10)
    .run();
```

[▶ Run this query](https://oldschool.runescape.wiki/api.php?action=bucket&query=bucket(%27exchange%27).select(%27name%27,%20%27value%27).where({%20%27name%27,%20%27!=%27,%20%27Coins%27%20}).where({%20%27value%27,%20%27%3E%27,%200%20}).limit(10).run())

### 8. Single Join

Join two buckets together. The join fields specify how rows match between tables.

```typescript
const query = bucket('infobox_item')
    .join('exchange', 'item_name', 'name')
    .select('item_name', 'weight', 'exchange.value')
    .limit(5)
    .run();
```

[▶ Run this query](https://oldschool.runescape.wiki/api.php?action=bucket&query=bucket(%27infobox_item%27).join(%27exchange%27,%20%27infobox_item.item_name%27,%20%27exchange.name%27).select(%27item_name%27,%20%27weight%27,%20%27exchange.value%27).limit(5).run())

### 9. Join with Alias

Use an alias to give joined buckets shorter names in your TypeScript code. The alias is resolved to the real bucket name in the generated Lua:

```typescript
const query = bucket('infobox_item')
    .join('exchange', 'ex', 'item_name', 'name')
    .select('item_name', 'ex.value', 'ex.limit')
    .where('ex.value', '>', 100000)
    .limit(10)
    .run();
```

[▶ Run this query](https://oldschool.runescape.wiki/api.php?action=bucket&query=bucket(%27infobox_item%27).join(%27exchange%27,%20%27infobox_item.item_name%27,%20%27exchange.name%27).select(%27item_name%27,%20%27exchange.value%27,%20%27exchange.limit%27).where({%20%27exchange.value%27,%20%27%3E%27,%20100000%20}).limit(10).run())

### 10. Multiple Joins

Join three buckets to combine item info, GE prices, and shop data.

```typescript
const query = bucket('infobox_item')
    .join('exchange', 'item_name', 'name')
    .join('storeline', 'item_name', 'sold_item')
    .select('item_name', 'weight', 'exchange.value', 'storeline.sold_by', 'storeline.store_sell_price')
    .limit(5)
    .run();
```

[▶ Run this query](https://oldschool.runescape.wiki/api.php?action=bucket&query=bucket(%27infobox_item%27).join(%27exchange%27,%20%27infobox_item.item_name%27,%20%27exchange.name%27).join(%27storeline%27,%20%27infobox_item.item_name%27,%20%27storeline.sold_item%27).select(%27item_name%27,%20%27weight%27,%20%27exchange.value%27,%20%27storeline.sold_by%27,%20%27storeline.store_sell_price%27).limit(5).run())

### 11. Ordering, Pagination & first()

Sort results, paginate through pages, or grab just the first result:

```typescript
const page2 = bucket('exchange')
    .select('name', 'value')
    .where('value', '>', 0)
    .orderBy('value', 'desc')
    .paginate(2, 25)
    .run();

const top = bucket('exchange')
    .select('name', 'value')
    .orderBy('value', 'desc')
    .first()
    .run();
```

[▶ Run page 2](https://oldschool.runescape.wiki/api.php?action=bucket&query=bucket(%27exchange%27).select(%27name%27,%20%27value%27).where({%20%27value%27,%20%27%3E%27,%200%20}).orderBy(%27value%27,%20%27desc%27).limit(25).offset(25).run())

### 12. Conditional Queries with when()

Build queries conditionally using `.when()`:

```typescript
const isMembers = true;
const query = bucket('infobox_item')
    .select('item_name', 'value', 'members')
    .when(isMembers, (q) => q.where('members', true))
    .limit(10)
    .run();
```

### 13. Full Complex Query

Multi-join with aliases, mixed conditions, ordering, and pagination.

```typescript
import { bucket, Bucket } from 'osrs-wiki-bucket-builder';

const query = bucket('infobox_item')
    .join('exchange', 'ex', 'item_name', 'name')
    .join('storeline', 'shop', 'item_name', 'sold_item')
    .select('item_name', 'weight', 'ex.value', 'ex.limit', 'shop.sold_by', 'shop.store_sell_price')
    .where('ex.value', '>', 1000)
    .whereNotNull('shop.sold_by')
    .orderBy('ex.value', 'desc')
    .limit(10)
    .run();
```

[▶ Run this query](https://oldschool.runescape.wiki/api.php?action=bucket&query=bucket(%27infobox_item%27).join(%27exchange%27,%20%27infobox_item.item_name%27,%20%27exchange.name%27).join(%27storeline%27,%20%27infobox_item.item_name%27,%20%27storeline.sold_item%27).select(%27item_name%27,%20%27weight%27,%20%27exchange.value%27,%20%27exchange.limit%27,%20%27storeline.sold_by%27,%20%27storeline.store_sell_price%27).where({%20%27exchange.value%27,%20%27%3E%27,%201000%20}).where({%20%27storeline.sold_by%27,%20%27!=%27,%20bucket.Null()%20}).orderBy(%27exchange.value%27,%20%27desc%27).limit(10).run())

---

## Convenience Helpers

| Method | Equivalent To |
|---|---|
| `.whereNot(field, value)` | `.where(field, '!=', value)` |
| `.whereNull(field)` | `.where(field, Bucket.Null())` |
| `.whereNotNull(field)` | `.where(field, '!=', Bucket.Null())` |
| `.whereBetween(field, [a, b])` | `.where(field, '>=', a).where(field, '<=', b)` |
| `.whereIn(field, [v1, v2])` | `.where(Bucket.Or([field, v1], [field, v2]))` |
| `.first()` | `.limit(1)` |
| `.paginate(page, perPage)` | `.limit(perPage).offset((page-1) * perPage)` |
| `.when(cond, fn)` | Conditionally applies `fn` if `cond` is true |
| `.clone()` | Creates an independent copy of the builder |

## Available Buckets

Browse all available buckets and their fields on the Wiki:
[Special:AllPages (Bucket namespace)](https://oldschool.runescape.wiki/w/Special:AllPages?from=&to=&namespace=9592)

## API Reference

- [Bucket Extension: Usage Guide](https://meta.weirdgloop.org/w/Extension:Bucket/Usage)
- [Bucket Extension: API](https://meta.weirdgloop.org/w/Extension:Bucket/Api)
- [Bucket Extension: Example Modules](https://meta.weirdgloop.org/w/Extension:Bucket/Example_modules)

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
