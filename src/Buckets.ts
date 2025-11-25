const sharedBucketFields = {
  page_name: "page_name",
  page_name_sub: "page_name_sub",
} as const;

export interface SharedBucketFields {
  page_name: string,
  page_name_sub: string
}

export const InfoboxItem = {
  ...sharedBucketFields,
  item_name: "item_name",
  image: "image",
  is_members_only: "is_members_only",
  item_id: "item_id",
  examine: "examine",
  high_alchemy_value: "high_alchemy_value",
  league_region: "league_region",
  release_date: "release_date",
  value: "value",
  weight: "weight",
  version_anchor: "version_anchor",
  buy_limit: "buy_limit",
  default_version: "default_version",
} as const;

export interface InfoboxItemRow extends SharedBucketFields{
  item_name: string,
  image: string, // this is a "PAGE" which is a url to the image,
  is_members_only: boolean,
  item_id: number,
  examime: string,
  high_alchemy_value: number,
  league_region: string,
  release_date: string,
  value: number,
  weight: number,
  version_anchor: string,
  buy_limit: number,
  default_version: boolean,
}

export const Exchange = {
  ...sharedBucketFields,
  id: "id",
  name: "name",
  value: "value",
  is_alchable: "is_alchable",
  high_alch: "high_alch",
  low_alch: "low_alch",
  limit: "limit",
  module: "module",
  is_historical: "is_historical",
  json: "json",
} as const;

export interface ExchangeRow extends SharedBucketFields{
  id: number,
  name: string,
  value: number,
  is_alchable: boolean,
  high_alch: number,
  low_alch: number,
  limit: number,
  module: string,
  is_historical: boolean,
  json: string
}

export const NpcId = {
  ...sharedBucketFields,
  id: "id"
} as const;

export interface NpcIdRow extends SharedBucketFields{
  id: number
}

export type BucketDefinitions = {
  exchange: {
    fields: typeof Exchange,
    row: ExchangeRow
  },
  npc_id: {
    fields: typeof NpcId,
    row: NpcIdRow
  },
  infobox_item: {
    fields: typeof InfoboxItem,
    row: InfoboxItemRow
  }
};