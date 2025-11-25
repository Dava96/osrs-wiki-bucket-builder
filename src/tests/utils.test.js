import { bucket } from '../helpers.ts';
import { expect, test } from 'vitest';
test('bucket', () => {
  const query = bucket('infobox_item')
    .select('item_id', 'image', 'examine')
    .where('item_name', 'Raw lobster')
    .run();
  expect(query).toBe(
    "bucket('infobox_item').select('item_id','image','examine').where('item_name','Raw lobster').run()",
  );
});
//# sourceMappingURL=utils.test.js.map
