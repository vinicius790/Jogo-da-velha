/** JSON Lines: um registro JSON por linha (usado na exportação do acervo de replays). */
export function toJSONL(records) {
  return records.map((record) => `${JSON.stringify(record)}\n`).join('');
}

export function fromJSONL(text) {
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}
