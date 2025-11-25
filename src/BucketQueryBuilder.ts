import { wrap } from './utils.js';

export const MIN_LIMIT = 1;
export const DEFAULT_LIMIT = 500;
export const MAX_LIMIT = 5000;
export const DEFAULT_OFFSET = 0;

class BucketQueryBuilder<BucketFields extends string, BucketValues> {
  private queryString: string[] = [];

  constructor(private bucketName: string) {
    this.queryString.push(`bucket('${this.bucketName}')`);
  }

  select(...fields: BucketFields[]): this {
    // Could expand this to include * meaning all fields
    this.queryString.push(`.select(${wrap(fields)})`);

    return this;
  }

  where<BucketField extends BucketFields & keyof BucketValues>(
    field: BucketField,
    value: BucketValues[BucketField],
  ): this {
    this.queryString.push(`.where('${field}','${value}')`);
    return this;
  }

  limit(limit: number = DEFAULT_LIMIT): this {
    if (limit <= 0) {
      limit = DEFAULT_LIMIT;
    }

    if (limit >= MIN_LIMIT && limit <= MAX_LIMIT) {
      this.queryString.push(`.limit(${limit})`);
    }

    return this;
  }

  run(): string {
    return this.queryString.join('') + '.run()';
  }
}

export default BucketQueryBuilder;
