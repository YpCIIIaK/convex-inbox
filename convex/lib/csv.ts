/** Minimal RFC 4180 CSV parser: quoted fields, escaped quotes, commas/newlines inside quotes, CRLF. */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

function detectDelimiter(text: string): string {
  const first = text.slice(0, text.search(/\r?\n|$/));
  return (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ",";
}

const ALIASES: Record<string, string[]> = {
  name: ["name", "tenant", "full name", "fullname", "tenant name"],
  email: ["email", "e-mail", "mail"],
  phone: ["phone", "telephone", "tel", "mobile", "phone number"],
  property: ["property", "building", "house", "property name"],
  address: ["address", "street", "street address"],
  unit: ["unit", "apartment", "apt", "flat", "suite"],
};

export type TenantRow = { name: string; email?: string; phone?: string; property?: string; address?: string; unit?: string };

/** Maps CSV rows to tenant rows by header names (case-insensitive, a few common aliases). */
export function toTenantRows(table: string[][]): { rows: TenantRow[]; errors: string[] } {
  const [header, ...body] = table;
  if (!header) return { rows: [], errors: ["File is empty"] };
  const index: Partial<Record<keyof TenantRow, number>> = {};
  header.forEach((h, i) => {
    const key = Object.entries(ALIASES).find(([, names]) => names.includes(h.trim().toLowerCase()))?.[0];
    if (key && index[key as keyof TenantRow] === undefined) index[key as keyof TenantRow] = i;
  });
  if (index.name === undefined) return { rows: [], errors: [`No "name" column in header: ${header.join(", ")}`] };
  const rows: TenantRow[] = [];
  const errors: string[] = [];
  body.forEach((r, n) => {
    const get = (k: keyof TenantRow) => (index[k] === undefined ? undefined : r[index[k]!]?.trim() || undefined);
    const name = get("name");
    if (!name) {
      errors.push(`Row ${n + 2}: empty name`);
      return;
    }
    rows.push({ name, email: get("email"), phone: get("phone"), property: get("property"), address: get("address"), unit: get("unit") });
  });
  return { rows, errors };
}
