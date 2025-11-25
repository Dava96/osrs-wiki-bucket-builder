import { bucket } from './helpers.js';

// Temporary manual test to verify the query builder and that the API responds.
try {
  const query = bucket('infobox_item')
    .select('item_id', 'image', 'examine')
    .where('item_name', 'Raw lobster')
    .run();

  const url = `https://oldschool.runescape.wiki/api.php?action=bucket&format=json&query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  console.log('Response JSON:', data);
} catch (err) {
  console.error('Request error:', err);
}
