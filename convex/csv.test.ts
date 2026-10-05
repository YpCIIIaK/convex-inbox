import { describe, expect, test } from "vitest";
import { parseCsv, toTenantRows } from "./lib/csv";

describe("parseCsv", () => {
  test("quotes, escaped quotes, newlines in quotes, CRLF", () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi""\nthere"\r\n')).toEqual([["a", "b"], ["x, y", 'say "hi"\nthere']]);
  });
  test("detects semicolon delimiter and skips blank lines", () => {
    expect(parseCsv("name;email\n\nAnna;a@example.com\n")).toEqual([["name", "email"], ["Anna", "a@example.com"]]);
  });
});

describe("toTenantRows", () => {
  test("maps aliased headers and reports rows without a name", () => {
    const { rows, errors } = toTenantRows(parseCsv("Tenant,E-mail,Apartment,Building\nAnna,a@example.com,2B,Maple Court\n,b@example.com,1,Maple Court\n"));
    expect(rows).toEqual([{ name: "Anna", email: "a@example.com", unit: "2B", property: "Maple Court", phone: undefined, address: undefined }]);
    expect(errors).toEqual(["Row 3: empty name"]);
  });
  test("fails without a name column", () => {
    expect(toTenantRows([["email"], ["a@example.com"]]).errors[0]).toMatch(/No "name" column/);
  });
});
