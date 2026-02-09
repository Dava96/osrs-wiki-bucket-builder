import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bucket } from '../query-builder.js';
import { BucketResponse } from '../types.js';
import type { BucketApiResponse } from '../types.js';
import type { InferBucketResult, BucketMetaFields } from '../response-types.js';

const currentDir = dirname(fileURLToPath(import.meta.url));

function loadFixture<T = unknown>(filename: string): BucketApiResponse<T> {
    const filePath = resolve(currentDir, 'fixtures', filename);
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as BucketApiResponse<T>;
}

/**
 * Helper to assert that a type is assignable to another at compile time.
 * If the types don't match, TypeScript will error on the call site.
 */
function assertType<_T>(_value: _T): void {
    // compile-time only
}

describe('InferBucketResult', () => {
    describe('simple select', () => {
        test('infers selected field types from the main bucket', () => {
            const query = bucket('exchange').select('id', 'name', 'value');
            expect(query).toBeDefined();
            type Result = InferBucketResult<typeof query>;

            const mockRow: Result = {
                id: 4151,
                name: 'Abyssal whip',
                value: 120001,
                page_name: 'Abyssal whip',
                page_name_sub: '',
            };

            assertType<{ id: number; name: string; value: number } & BucketMetaFields>(mockRow);
            expect(mockRow.id).toBe(4151);
            expect(mockRow.name).toBe('Abyssal whip');
        });

        test('infers array types for repeated fields', () => {
            const query = bucket('dependency_list').select('require', 'load_data');
            expect(query).toBeDefined();
            type Result = InferBucketResult<typeof query>;

            const mockRow: Result = {
                require: ['Module:Coins image'],
                load_data: ['Module:GEPrices/data.json'],
                page_name: 'TestPage',
                page_name_sub: '',
            };

            assertType<{ require: string[]; load_data: string[] } & BucketMetaFields>(mockRow);
            expect(mockRow.require).toEqual(['Module:Coins image']);
        });
    });

    describe('no select (all fields)', () => {
        test('defaults to the full bucket type when no select is called', () => {
            const query = bucket('exchange');
            expect(query).toBeDefined();
            type Result = InferBucketResult<typeof query>;

            const mockRow: Result = {
                id: 4151,
                name: 'Abyssal whip',
                value: 120001,
                is_alchable: true,
                high_alch: 72000,
                low_alch: 48000,
                limit: 70,
                module: 'Module:Exchange/Abyssal whip',
                is_historical: false,
                json: '{}',
                page_name: 'Abyssal whip',
                page_name_sub: '',
            };

            expect(mockRow.name).toBe('Abyssal whip');
            expect(typeof mockRow.is_alchable).toBe('boolean');
        });
    });

    describe('join with dot-notation', () => {
        test('infers types for dot-prefixed joined fields', () => {
            const query = bucket('storeline')
                .join('exchange', 'sold_item', 'name')
                .select('sold_by', 'sold_item', 'exchange.value');
            expect(query).toBeDefined();
            type Result = InferBucketResult<typeof query>;

            const mockRow: Result = {
                sold_by: "Bob's Brilliant Axes.",
                sold_item: 'Bronze pickaxe',
                'exchange.value': 1,
                page_name: 'Bronze pickaxe',
                page_name_sub: '',
            };

            assertType<{ sold_by: string; sold_item: string; 'exchange.value': number } & BucketMetaFields>(mockRow);
            expect(mockRow['exchange.value']).toBe(1);
        });
    });

    describe('join with alias', () => {
        test('infers types using the alias prefix', () => {
            const query = bucket('infobox_item')
                .join('exchange', 'ex', 'item_name', 'name')
                .select('item_name', 'weight', 'ex.value');
            expect(query).toBeDefined();
            type Result = InferBucketResult<typeof query>;

            const mockRow: Result = {
                item_name: 'Abyssal whip',
                weight: 0.453,
                'ex.value': 120001,
                page_name: 'Abyssal whip',
                page_name_sub: '',
            };

            assertType<{ item_name: string; weight: number; 'ex.value': number } & BucketMetaFields>(mockRow);
            expect(mockRow['ex.value']).toBe(120001);
        });
    });

    describe('wildcard select', () => {
        test('* resolves to the full main bucket type', () => {
            const query = bucket('exchange').select('*');
            expect(query).toBeDefined();
            type Result = InferBucketResult<typeof query>;

            const mockRow: Result = {
                id: 4151,
                name: 'Abyssal whip',
                value: 120001,
                is_alchable: true,
                high_alch: 72000,
                low_alch: 48000,
                limit: 70,
                module: 'Module:Exchange/Abyssal whip',
                is_historical: false,
                json: '{}',
                page_name: 'Abyssal whip',
                page_name_sub: '',
            };

            expect(mockRow.id).toBe(4151);
        });
    });

    describe('chained selects accumulate', () => {
        test('multiple select calls merge their types', () => {
            const query = bucket('exchange').select('id').select('name');
            expect(query).toBeDefined();
            type Result = InferBucketResult<typeof query>;

            const mockRow: Result = {
                id: 4151,
                name: 'Abyssal whip',
                page_name: 'Abyssal whip',
                page_name_sub: '',
            };

            assertType<{ id: number } & { name: string } & BucketMetaFields>(mockRow);
            expect(mockRow.id).toBe(4151);
            expect(mockRow.name).toBe('Abyssal whip');
        });
    });
});

describe('toUrl', () => {
    test('generates a valid OSRS Wiki API URL', () => {
        const url = bucket('exchange').select('name', 'value').toUrl();

        expect(url).toContain('https://oldschool.runescape.wiki/api.php');
        expect(url).toContain('action=bucket');
        expect(url).toContain('format=json');
        expect(url).toContain('query=');
    });

    test('URI-encodes the query parameter', () => {
        const url = bucket('exchange').select('name').where('name', 'Abyssal whip').toUrl();

        expect(url).toContain('query=');
        expect(url).toContain(encodeURIComponent('Abyssal whip'));
    });

    test('produces a fetchable URL structure', () => {
        const url = bucket('exchange').select('id').toUrl();
        const parsed = new URL(url);

        expect(parsed.searchParams.get('action')).toBe('bucket');
        expect(parsed.searchParams.get('format')).toBe('json');
        expect(parsed.searchParams.has('query')).toBe(true);
    });
});

describe('BucketResponse.from', () => {
    test('creates a typed response from a query builder', () => {
        const query = bucket('exchange').select('id', 'name', 'value');
        const raw = loadFixture('response_success.json') as BucketApiResponse<InferBucketResult<typeof query>>;
        const response = BucketResponse.from(query, raw);

        expect(response.results).toHaveLength(1);
        expect(response.query).toContain("bucket('exchange')");
    });

    test('preserves error handling from the base class', () => {
        const query = bucket('exchange').select('name');
        const raw = loadFixture('response_error.json') as BucketApiResponse<InferBucketResult<typeof query>>;
        const response = BucketResponse.from(query, raw);

        expect(response.error).toBeDefined();
        expect(() => response.results).toThrow();
    });

    test('first() returns the first result or undefined', () => {
        const query = bucket('exchange').select('id', 'name', 'value');
        const raw = loadFixture('response_success.json') as BucketApiResponse<InferBucketResult<typeof query>>;
        const response = BucketResponse.from(query, raw);
        const first = response.first();

        expect(first).toBeDefined();
    });

    test('empty response returns undefined for first()', () => {
        const query = bucket('exchange').select('name');
        type Result = InferBucketResult<typeof query>;
        const raw: BucketApiResponse<Result> = {
            bucketQuery: "bucket('exchange').select('name').run()",
            bucket: [],
        };
        const response = BucketResponse.from(query, raw);

        expect(response.first()).toBeUndefined();
        expect(response.results).toHaveLength(0);
    });
});

describe('ValidField constrains select and where', () => {
    test('select accepts valid field names for the main bucket', () => {
        const sql = bucket('exchange').select('id', 'name', 'value').run({ encodeURI: false });
        expect(sql).toContain("select('id', 'name', 'value')");
    });

    test('select accepts dot-notation after a join', () => {
        const sql = bucket('storeline')
            .join('exchange', 'sold_item', 'name')
            .select('sold_by', 'exchange.value')
            .run({ encodeURI: false });

        expect(sql).toContain("select('sold_by', 'exchange.value')");
    });

    test('select accepts wildcard *', () => {
        const sql = bucket('exchange').select('*').run({ encodeURI: false });
        expect(sql).toContain('.select(');
    });

    test('where accepts valid field names', () => {
        const sql = bucket('exchange').where('name', 'Abyssal whip').run({ encodeURI: false });
        expect(sql).toContain("{ 'name', 'Abyssal whip' }");
    });

    test('where accepts dot-notation fields after join', () => {
        const sql = bucket('storeline')
            .join('exchange', 'sold_item', 'name')
            .where('exchange.value', '>', 100)
            .run({ encodeURI: false });

        expect(sql).toContain("{ 'exchange.value', '>', 100 }");
    });
});
