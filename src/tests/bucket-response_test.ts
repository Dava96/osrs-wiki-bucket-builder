import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BucketResponse } from '../types.js';
import type { BucketApiResponse } from '../types.js';

const currentDir = dirname(fileURLToPath(import.meta.url));

function loadFixture<T = unknown>(filename: string): BucketApiResponse<T> {
    const filePath = resolve(currentDir, 'fixtures', filename);
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as BucketApiResponse<T>;
}

interface ExchangeRow {
    id: number;
    name: string;
    value: number;
}

interface InfoboxItemRow {
    item_name: string;
    item_id: string[];
    image: string[];
}

interface InfoboxItemNullableRow {
    item_name: string;
    weight: number | null;
    quest: string | null;
}

describe('BucketResponse', () => {
    describe('query accessor', () => {
        test.each([
            {
                name: 'returns the echoed Lua query string from a success response',
                fixture: 'response_success.json',
                expected: "bucket('exchange').select('id', 'name', 'value').where({ 'name', 'Abyssal whip' }).run()",
            },
            {
                name: 'returns the echoed Lua query string from an error response',
                fixture: 'response_error.json',
                expected: "bucket('invalid_bucket').run()",
            },
        ])('$name', ({ fixture, expected }) => {
            const response = new BucketResponse(loadFixture(fixture));
            expect(response.query).toBe(expected);
        });
    });

    describe('results accessor', () => {
        test('returns the array of rows from a successful response', () => {
            const response = new BucketResponse<ExchangeRow>(loadFixture<ExchangeRow>('response_success.json'));
            const results = response.results;

            expect(results).toHaveLength(1);
            expect(results[0]).toEqual({ id: 4151, name: 'Abyssal whip', value: 120001 });
        });

        test('returns all rows from a multi-row response', () => {
            const response = new BucketResponse<ExchangeRow>(loadFixture<ExchangeRow>('response_multiple_rows.json'));
            const results = response.results;

            expect(results).toHaveLength(3);
            expect(results.map((r) => r.name)).toEqual(['Abyssal whip', 'Armadyl godsword', 'Dragon warhammer']);
        });

        test('returns an empty array when no rows match', () => {
            const response = new BucketResponse(loadFixture('response_empty.json'));
            expect(response.results).toEqual([]);
        });

        test('throws an error when the response contains an error', () => {
            const response = new BucketResponse(loadFixture('response_error.json'));
            expect(() => response.results).toThrow("Bucket API Error: Bucket 'invalid_bucket' does not exist");
        });

        test('returns an empty array when bucket property is missing', () => {
            const raw: BucketApiResponse = { bucketQuery: "bucket('exchange').run()" };
            const response = new BucketResponse(raw);
            expect(response.results).toEqual([]);
        });
    });

    describe('first', () => {
        test('returns the first row from a successful response', () => {
            const response = new BucketResponse<ExchangeRow>(loadFixture<ExchangeRow>('response_multiple_rows.json'));
            const first = response.first();

            expect(first).toBeDefined();
            expect(first!.name).toBe('Abyssal whip');
            expect(first!.id).toBe(4151);
            expect(first!.value).toBe(120001);
        });

        test('returns undefined when no rows match', () => {
            const response = new BucketResponse(loadFixture('response_empty.json'));
            expect(response.first()).toBeUndefined();
        });

        test('throws when the response contains an error', () => {
            const response = new BucketResponse(loadFixture('response_error.json'));
            expect(() => response.first()).toThrow('Bucket API Error');
        });
    });

    describe('error accessor', () => {
        test('returns the error message from a failed response', () => {
            const response = new BucketResponse(loadFixture('response_error.json'));
            expect(response.error).toBe("Bucket 'invalid_bucket' does not exist");
        });

        test('returns undefined when the response has no error', () => {
            const response = new BucketResponse(loadFixture('response_success.json'));
            expect(response.error).toBeUndefined();
        });
    });

    describe('array field handling', () => {
        test('preserves array-typed fields in response rows', () => {
            const response = new BucketResponse<InfoboxItemRow>(
                loadFixture<InfoboxItemRow>('response_with_arrays.json'),
            );
            const row = response.first();

            expect(row).toBeDefined();
            expect(row!.item_name).toBe('Raw lobster');
            expect(row!.item_id).toEqual(['377']);
            expect(row!.image).toEqual(['File:Raw lobster.png']);
            expect(Array.isArray(row!.item_id)).toBe(true);
            expect(Array.isArray(row!.image)).toBe(true);
        });
    });

    describe('null field handling', () => {
        test('preserves null values alongside populated fields', () => {
            const response = new BucketResponse<InfoboxItemNullableRow>(
                loadFixture<InfoboxItemNullableRow>('response_with_nulls.json'),
            );
            const results = response.results;

            expect(results).toHaveLength(2);

            const bronzeDagger = results[0]!;
            expect(bronzeDagger.item_name).toBe('Bronze dagger');
            expect(bronzeDagger.weight).toBe(0.4);
            expect(bronzeDagger.quest).toBeNull();

            const dragonScimitar = results[1]!;
            expect(dragonScimitar.item_name).toBe('Dragon scimitar');
            expect(dragonScimitar.weight).toBe(1.8);
            expect(dragonScimitar.quest).toBe('Monkey Madness I');
        });
    });
});
