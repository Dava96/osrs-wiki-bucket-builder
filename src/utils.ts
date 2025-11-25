export function wrap(fields: string[]): string {
  return fields.map(field => `'${field}'`).join(',');
}