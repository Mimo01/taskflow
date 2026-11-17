/**
 * Text colour palette (Jira's standard editor palette). Every value is a
 * lowercase hex string accepted by the Phase 97 `isSafeColor` guard; the test
 * in colour.test.ts is the gate.
 */
export const TEXT_PALETTE: readonly { name: string; value: string }[] = [
  { name: 'Dark grey', value: '#172b4d' },
  { name: 'Grey', value: '#6b778c' },
  { name: 'Light grey', value: '#97a0af' },
  { name: 'Purple', value: '#6554c0' },
  { name: 'Violet', value: '#8777d9' },
  { name: 'Blue', value: '#0052cc' },
  { name: 'Light blue', value: '#2684ff' },
  { name: 'Teal', value: '#00b8d9' },
  { name: 'Green', value: '#00875a' },
  { name: 'Light green', value: '#36b37e' },
  { name: 'Lime', value: '#57d9a3' },
  { name: 'Yellow', value: '#ff991f' },
  { name: 'Orange', value: '#ff8b00' },
  { name: 'Red', value: '#de350b' },
  { name: 'Light red', value: '#ff5630' },
  { name: 'Pink', value: '#e774bb' },
  { name: 'Black', value: '#000000' },
  { name: 'White', value: '#ffffff' },
  { name: 'Brown', value: '#8d6e63' },
  { name: 'Navy', value: '#091e42' },
  { name: 'Slate', value: '#505f79' },
  { name: 'Olive', value: '#7a8b0a' },
  { name: 'Magenta', value: '#c0369b' },
  { name: 'Cyan', value: '#00a3bf' },
];
