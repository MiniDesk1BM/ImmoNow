/**
 * Lecteur CSV minimal (RFC 4180 : champs entre guillemets, guillemets doublés, CRLF/LF),
 * en générateur pour éviter de matérialiser tout le fichier (DVF départemental ≈ 25 Mo).
 */
export function* csvRows(text: string, sep = ","): Generator<string[]> {
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const n = text.length;
  for (let i = 0; i < n; i++) {
    const c = text.charAt(i);
    if (quoted) {
      if (c === '"') {
        if (text.charAt(i + 1) === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text.charAt(i + 1) === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") yield row;
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    yield row;
  }
}
