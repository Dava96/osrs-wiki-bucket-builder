import { jest } from '@jest/globals';
import { BucketQueryBuilder, bucket } from '../query-builder.js';
import { Bucket, QUERY_DEFAULTS } from '../types.js';
import { BUCKET_FIELDS } from '../generated/definitions.js';

const EXCHANGE_FIELDS = BUCKET_FIELDS['exchange']!;

function buildQuery() {
    return bucket('exchange');
}

function buildJoinedQuery() {
    return bucket('exchange').join('exchange', 'src', 'id', 'name');
}

describe('BucketQueryBuilder', () => {
    describe('select', () => {
        test.each([
            {
                name: 'single field',
                fields: ['id'] as const,
                expected: ".select('id')",
            },
            {
                name: 'multiple fields',
                fields: ['id', 'name'] as const,
                expected: ".select('id', 'name')",
            },
            {
                name: 'dot notation passthrough for unknown alias',
                fields: ['Category:X.foo'] as const,
                expected: ".select('Category:X.foo')",
            },
        ])('$name', ({ fields, expected }) => {
            const sql = buildQuery()
                .select(...fields)
                .printSQL();
            expect(sql).toContain(expected);
        });

        test('wildcard * expands to all main bucket fields', () => {
            const sql = buildQuery().select('*').printSQL();
            const expectedFields = EXCHANGE_FIELDS.map((f) => `'${f}'`).join(', ');
            expect(sql).toContain(`.select(${expectedFields})`);
        });

        test('wildcard * with join expands both buckets', () => {
            const sql = buildJoinedQuery().select('*').printSQL();
            for (const field of EXCHANGE_FIELDS) {
                expect(sql).toContain(`'${field}'`);
            }
            expect(sql).toContain("'exchange.");
        });

        test('alias.* expands to all fields of aliased bucket', () => {
            const sql = buildJoinedQuery().select('src.*').printSQL();
            for (const field of EXCHANGE_FIELDS) {
                expect(sql).toContain(`'exchange.${field}'`);
            }
        });

        test('alias.field resolves to real bucket name', () => {
            const sql = buildJoinedQuery().select('src.name').printSQL();
            expect(sql).toContain(".select('exchange.name')");
        });

        test('deduplicates repeated fields', () => {
            const sql = buildQuery().select('id', 'id').printSQL();
            expect(sql).toContain(".select('id')");
            expect(sql).not.toContain("'id', 'id'");
        });

        test('unknown bucket with no BUCKET_FIELDS entry falls back to literal star', () => {
            const builder = new BucketQueryBuilder('exchange');
            Object.defineProperty(builder, 'mainBucket', { value: '__fake_empty__' });
            Object.defineProperty(builder, 'aliasMap', {
                value: { __fake_empty__: '__fake_empty__' },
            });
            builder.select('*');
            const sql = builder.printSQL();
            expect(sql).toContain(".select('*')");
        });
    });

    describe('join', () => {
        test('3-arg auto-qualifies source and target fields', () => {
            const sql = bucket('exchange').join('exchange', 'name', 'id').printSQL();
            expect(sql).toContain(".join('exchange', 'exchange.name', 'exchange.id')");
        });

        test('4-arg resolves alias internally and outputs 3-arg join', () => {
            const sql = buildJoinedQuery().printSQL();
            expect(sql).toContain(".join('exchange', 'exchange.id', 'exchange.name')");
        });

        test('dotted source resolves alias', () => {
            const q = bucket('exchange').join('exchange', 'a1', 'id', 'id').join('exchange', 'a1.name', 'id');
            const sql = q.printSQL();
            expect(sql).toContain("'exchange.name'");
        });

        test('dotted target resolves alias', () => {
            const q = bucket('exchange').join('exchange', 'a1', 'id', 'id').join('exchange', 'id', 'a1.name');
            const sql = q.printSQL();
            expect(sql).toContain("'exchange.name'");
        });

        test('dotted fields with unresolved alias pass through unchanged', () => {
            const sql = bucket('exchange').join('exchange', 'unknown.field', 'other.field').printSQL();
            expect(sql).toContain("'unknown.field'");
            expect(sql).toContain("'other.field'");
        });
    });

    describe('where', () => {
        test('field and number value', () => {
            const sql = buildQuery().where('id', 1).printSQL();
            expect(sql).toContain(".where({ 'id', 1 })");
        });

        test('field and string value quotes the value', () => {
            const sql = buildQuery().where('name', 'Dragon scimitar').printSQL();
            expect(sql).toContain(".where({ 'name', 'Dragon scimitar' })");
        });

        test('field, operator, and number value', () => {
            const sql = buildQuery().where('value', '>', 100).printSQL();
            expect(sql).toContain(".where({ 'value', '>', 100 })");
        });

        test('field, operator, and string value', () => {
            const sql = buildQuery().where('name', '!=', 'coins').printSQL();
            expect(sql).toContain(".where({ 'name', '!=', 'coins' })");
        });

        test('field with BucketHelperCondition (Null)', () => {
            const sql = buildQuery().where('name', Bucket.Null()).printSQL();
            expect(sql).toContain(".where({ 'name', bucket.Null() })");
        });

        test('field, operator, BucketHelperCondition (Not Null)', () => {
            const sql = buildQuery().where('name', '!=', Bucket.Null()).printSQL();
            expect(sql).toContain(".where({ 'name', '!=', bucket.Null() })");
        });

        test('multiple condition objects grouped', () => {
            const cond1: [string, number] = ['id', 1];
            const cond2: [string, number] = ['value', 50];
            const sql = buildQuery().where(cond1, cond2).printSQL();
            expect(sql).toContain("{ 'id', 1 }");
            expect(sql).toContain("{ 'value', 50 }");
        });

        test('alias expansion in condition fields', () => {
            const sql = buildJoinedQuery().where('src.name', 'test').printSQL();
            expect(sql).toContain(".where({ 'exchange.name', 'test' })");
        });

        test('fallback branch with unexpected arg count', () => {
            const builder = buildQuery();
            const whereMethod = builder.where.bind(builder);
            whereMethod.apply(builder, ['a', 'b', 'c', 'd'] as never);
            const sql = builder.printSQL();
            expect(sql).toContain('.where(');
            expect(sql).toContain('"a"');
            expect(sql).toContain('"d"');
        });
    });

    describe('where helpers', () => {
        test('whereNot generates != operator', () => {
            const sql = buildQuery().whereNot('name', 'coins').printSQL();
            expect(sql).toContain(".where({ 'name', '!=', 'coins' })");
        });

        test('whereNull generates Null helper', () => {
            const sql = buildQuery().whereNull('name').printSQL();
            expect(sql).toContain(".where({ 'name', bucket.Null() })");
        });

        test('whereNotNull generates != Null', () => {
            const sql = buildQuery().whereNotNull('name').printSQL();
            expect(sql).toContain(".where({ 'name', '!=', bucket.Null() })");
        });

        test('whereBetween generates two range conditions', () => {
            const sql = buildQuery().whereBetween('value', [10, 100]).printSQL();
            expect(sql).toContain(".where({ 'value', '>=', 10 })");
            expect(sql).toContain(".where({ 'value', '<=', 100 })");
        });

        test('whereIn generates Bucket.Or with each value', () => {
            const sql = buildQuery().whereIn('name', ['a', 'b', 'c']).printSQL();
            expect(sql).toContain("bucket.Or({ 'name', 'a' }, { 'name', 'b' }, { 'name', 'c' })");
        });
    });

    describe('string escaping', () => {
        describe('escapeLuaString unit tests', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const escaper = (buildQuery() as any).escapeLuaString.bind(buildQuery());

            test.each([
                { name: 'single quote', input: "Bob's Axes", expected: "Bob\\'s Axes" },
                { name: 'backslash', input: 'path\\to\\file', expected: 'path\\\\to\\\\file' },
                { name: 'both together', input: "It's a \\test", expected: "It\\'s a \\\\test" },
                { name: 'multiple apostrophes', input: "can't won't don't", expected: "can\\'t won\\'t don\\'t" },
                { name: 'no special characters', input: 'Dragon scimitar', expected: 'Dragon scimitar' },
                { name: 'empty string', input: '', expected: '' },
            ])('escapes $name correctly', ({ input, expected }) => {
                expect(escaper(input)).toBe(expected);
            });
        });

        test('apostrophe in where value', () => {
            const sql = buildQuery().where('name', "Bob's Brilliant Axes.").printSQL();
            expect(sql).toContain(".where({ 'name', 'Bob\\'s Brilliant Axes.' })");
        });

        test('backslash in where value', () => {
            const sql = buildQuery().where('name', 'path\\to\\file').printSQL();
            expect(sql).toContain(".where({ 'name', 'path\\\\to\\\\file' })");
        });

        test('apostrophe with operator', () => {
            const sql = buildQuery().where('name', '!=', "Bob's").printSQL();
            expect(sql).toContain("{ 'name', '!=', 'Bob\\'s' }");
        });

        test('apostrophe in whereNot', () => {
            const sql = buildQuery().whereNot('name', "Bob's").printSQL();
            expect(sql).toContain("{ 'name', '!=', 'Bob\\'s' }");
        });

        test('apostrophe in whereIn', () => {
            const sql = buildQuery().whereIn('name', ["Bob's", "Tim's"]).printSQL();
            expect(sql).toContain("{ 'name', 'Bob\\'s' }");
            expect(sql).toContain("{ 'name', 'Tim\\'s' }");
        });

        test('apostrophe in whereBetween', () => {
            const sql = buildQuery().whereBetween('name', ["a'b", "c'd"]).printSQL();
            expect(sql).toContain("{ 'name', '>=', 'a\\'b' }");
            expect(sql).toContain("{ 'name', '<=', 'c\\'d' }");
        });

        test('apostrophe in Bucket.And subconditions', () => {
            const sql = buildQuery()
                .where(Bucket.And(['name', "Bob's"], ['name', "Tim's"]))
                .printSQL();
            expect(sql).toContain("{ 'name', 'Bob\\'s' }");
            expect(sql).toContain("{ 'name', 'Tim\\'s' }");
        });

        test('apostrophe in Bucket.Or subconditions', () => {
            const sql = buildQuery()
                .where(Bucket.Or(['name', "Bob's"], ['name', "Tim's"]))
                .printSQL();
            expect(sql).toContain("{ 'name', 'Bob\\'s' }");
            expect(sql).toContain("{ 'name', 'Tim\\'s' }");
        });

        test('numbers and booleans are not affected', () => {
            const sql = buildQuery().where('id', 42).printSQL();
            expect(sql).toContain("{ 'id', 42 }");
        });
    });

    describe('when', () => {
        test('true condition executes callback', () => {
            let executed = false;
            buildQuery().when(true, () => {
                executed = true;
            });
            expect(executed).toBe(true);
        });

        test('false condition skips callback', () => {
            let executed = false;
            buildQuery().when(false, () => {
                executed = true;
            });
            expect(executed).toBe(false);
        });

        test('callback receives the builder for chaining', () => {
            const sql = buildQuery()
                .when(true, (q) => {
                    q.where('id', 1);
                })
                .printSQL();
            expect(sql).toContain(".where({ 'id', 1 })");
        });
    });

    describe('formatCondition', () => {
        test('Bucket.And renders both subconditions', () => {
            const sql = buildQuery()
                .where(Bucket.And(['id', 1], ['value', 50]))
                .printSQL();
            expect(sql).toContain("bucket.And({ 'id', 1 }, { 'value', 50 })");
        });

        test('Bucket.Or renders all subconditions', () => {
            const sql = buildQuery()
                .where(Bucket.Or(['id', 1], ['id', 2]))
                .printSQL();
            expect(sql).toContain("bucket.Or({ 'id', 1 }, { 'id', 2 })");
        });

        test('Bucket.Not wraps inner condition', () => {
            const sql = buildQuery()
                .where(Bucket.Not(['id', 1]))
                .printSQL();
            expect(sql).toContain("bucket.Not({ 'id', 1 })");
        });

        test('Bucket.Null renders standalone', () => {
            const sql = buildQuery().whereNull('name').printSQL();
            expect(sql).toContain('bucket.Null()');
        });

        test('unknown object falls back to JSON.stringify', () => {
            const builder = buildQuery();
            const weird = { custom: 'data' };
            builder.where(weird as never);
            const sql = builder.printSQL();
            expect(sql).toContain('.where({"custom":"data"})');
        });

        test('3-element array condition with helper value', () => {
            const sql = buildQuery()
                .where(Bucket.Not(['name', '!=', Bucket.Null()]))
                .printSQL();
            expect(sql).toContain("bucket.Not({ 'name', '!=', bucket.Null() })");
        });
    });

    describe('orderBy', () => {
        test('basic field and direction', () => {
            const sql = buildQuery().select('id').orderBy('id', 'asc').printSQL();
            expect(sql).toContain(".orderBy('id', 'asc')");
        });

        test('warns when field is not in selections', () => {
            const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const builder = buildQuery().select('id');
            (builder as BucketQueryBuilder<'exchange', string, Record<string, unknown>>).orderBy('name', 'desc');
            builder.printSQL();
            expect(spy).toHaveBeenCalledWith(
                expect.stringContaining("orderBy field 'name' is not explicitly selected"),
            );
            spy.mockRestore();
        });

        test('no warning with global wildcard *', () => {
            const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const builder = buildQuery().select('*');
            (builder as BucketQueryBuilder<'exchange', string, Record<string, unknown>>).orderBy('value', 'asc');
            builder.printSQL();
            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        });

        test('no warning with alias.* that covers the field', () => {
            const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const builder = buildJoinedQuery().select('src.*');
            (builder as BucketQueryBuilder<'exchange', string, Record<string, unknown>>).orderBy('src.name', 'asc');
            builder.printSQL();
            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        });

        test('alias.* does not cover unrelated prefix', () => {
            const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const builder = buildJoinedQuery().select('src.*');
            (builder as BucketQueryBuilder<'exchange', string, Record<string, unknown>>).orderBy('other.name', 'desc');
            builder.printSQL();
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });

        test('no warning when no selections exist', () => {
            const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            (buildQuery() as BucketQueryBuilder<'exchange', string, Record<string, unknown>>).orderBy('id', 'asc');
            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        });

        test('resolves alias in output', () => {
            const sql = buildJoinedQuery().select('src.name').orderBy('src.name', 'desc').printSQL();
            expect(sql).toContain(".orderBy('exchange.name', 'desc')");
        });
    });

    describe('limit', () => {
        test.each([
            { input: 10, expected: '.limit(10)' },
            { input: 1, expected: '.limit(1)' },
            { input: QUERY_DEFAULTS.MAX_LIMIT, expected: `.limit(${QUERY_DEFAULTS.MAX_LIMIT})` },
        ])('limit($input) outputs $expected', ({ input, expected }) => {
            const sql = buildQuery().limit(input).printSQL();
            expect(sql).toContain(expected);
        });

        test('zero or negative resets to default (not in output)', () => {
            const sqlZero = buildQuery().limit(0).printSQL();
            const sqlNeg = buildQuery().limit(-5).printSQL();
            expect(sqlZero).not.toContain('.limit(');
            expect(sqlNeg).not.toContain('.limit(');
        });

        test('exceeding max clamps and warns', () => {
            const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const sql = buildQuery().limit(10000).printSQL();
            expect(sql).toContain(`.limit(${QUERY_DEFAULTS.MAX_LIMIT})`);
            expect(spy).toHaveBeenCalledWith(expect.stringContaining('exceeds max'));
            spy.mockRestore();
        });

        test('default limit is not rendered in output', () => {
            const sql = buildQuery().printSQL();
            expect(sql).not.toContain('.limit(');
        });
    });

    describe('offset and pagination', () => {
        test('offset renders in output', () => {
            const sql = buildQuery().offset(50).printSQL();
            expect(sql).toContain('.offset(50)');
        });

        test('default offset is not rendered', () => {
            const sql = buildQuery().printSQL();
            expect(sql).not.toContain('.offset(');
        });

        test('paginate computes limit and offset', () => {
            const sql = buildQuery().paginate(3, 25).printSQL();
            expect(sql).toContain('.limit(25)');
            expect(sql).toContain('.offset(50)');
        });

        test('paginate with page < 1 treats as page 1', () => {
            const sql = buildQuery().paginate(0, 10).printSQL();
            expect(sql).toContain('.limit(10)');
            expect(sql).not.toContain('.offset(');
        });

        test('first sets limit to 1', () => {
            const sql = buildQuery().first().printSQL();
            expect(sql).toContain('.limit(1)');
        });
    });

    describe('clone', () => {
        test('produces an independent copy', () => {
            const original = buildQuery().where('id', 1);
            const cloned = original.clone();

            original.where('id', 2);

            const originalSql = original.printSQL();
            const clonedSql = cloned.printSQL();

            expect(originalSql).toContain("{ 'id', 2 }");
            expect(clonedSql).not.toContain("{ 'id', 2 }");
            expect(clonedSql).toContain("{ 'id', 1 }");
        });
    });

    describe('run', () => {
        test('returns encoded string by default', () => {
            const builder = buildQuery().select('id').where('id', 1);
            const raw = builder.printSQL();
            expect(builder.run()).toBe(encodeURIComponent(raw));
        });

        test('returns raw string when encodeURI is false', () => {
            const builder = buildQuery().select('id').where('id', 1);
            expect(builder.run({ encodeURI: false })).toBe(builder.printSQL());
        });
    });

    describe('bucket factory', () => {
        test('creates a BucketQueryBuilder instance', () => {
            const b = bucket('exchange');
            expect(b).toBeInstanceOf(BucketQueryBuilder);
        });

        test('produced builder targets the correct bucket', () => {
            const sql = bucket('exchange').printSQL();
            expect(sql.startsWith("bucket('exchange')")).toBe(true);
        });
    });

    describe('printSQL structure', () => {
        test('minimal query has bucket and run', () => {
            const sql = buildQuery().printSQL();
            expect(sql).toBe("bucket('exchange').run()");
        });

        test('full query chains all clauses in correct order', () => {
            const sql = buildQuery()
                .join('exchange', 'src', 'id', 'name')
                .select('id', 'src.name')
                .where('id', 1)
                .orderBy('id', 'asc')
                .limit(10)
                .offset(5)
                .printSQL();

            const joinIdx = sql.indexOf('.join(');
            const selectIdx = sql.indexOf('.select(');
            const whereIdx = sql.indexOf('.where(');
            const orderIdx = sql.indexOf('.orderBy(');
            const limitIdx = sql.indexOf('.limit(');
            const offsetIdx = sql.indexOf('.offset(');
            const runIdx = sql.indexOf('.run()');

            expect(joinIdx).toBeLessThan(selectIdx);
            expect(selectIdx).toBeLessThan(whereIdx);
            expect(whereIdx).toBeLessThan(orderIdx);
            expect(orderIdx).toBeLessThan(limitIdx);
            expect(limitIdx).toBeLessThan(offsetIdx);
            expect(offsetIdx).toBeLessThan(runIdx);
        });
    });
});
