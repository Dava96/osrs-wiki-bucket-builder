import BucketQueryBuilder from "./BucketQueryBuilder.js";
import type { BucketDefinitions } from './Buckets.js';

export function bucket<BucketName extends keyof BucketDefinitions>(bucketName: BucketName) {
  type BucketFields = Extract<keyof BucketDefinitions[BucketName]["fields"], string>;
  type BucketValues = BucketDefinitions[BucketName]['row'];
  return new BucketQueryBuilder<BucketFields, BucketValues>(bucketName);
}