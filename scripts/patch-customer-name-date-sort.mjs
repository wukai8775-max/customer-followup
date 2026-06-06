import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) {
    console.warn(`Skipping ${label}; pattern not found`);
    return source;
  }
  return source.replace(search, replacement);
}

const appPath = new URL("../src/App.tsx", import.meta.url);
let source = readFileSync(appPath, "utf8");

if (!source.includes("function customerNameDateValue(")) {
  source = replaceOnce(
    source,
    `const emptyOptions: OptionsByCategory = {
  countries: [],
  sources: [],
  tags: [],
  logistics_companies: []
};`,
    `const emptyOptions: OptionsByCategory = {
  countries: [],
  sources: [],
  tags: [],
  logistics_companies: []
};

function customerNameDateValue(name: string) {
  const match = name.match(/(?:^|[^\\d])(\\d{1,2})[./月-](\\d{1,2})(?!\\d)/);
  if (!match) return Number.NaN;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    return Number.NaN;
  }
  return month * 100 + day;
}

function compareCustomerNameDate(a: Customer, b: Customer, ascending: boolean) {
  const aDate = customerNameDateValue(a.name);
  const bDate = customerNameDateValue(b.name);
  const aMissing = !Number.isFinite(aDate);
  const bMissing = !Number.isFinite(bDate);
  if (aMissing && bMissing) return a.name.localeCompare(b.name, "zh-CN") || a.id.localeCompare(b.id);
  if (aMissing) return 1;
  if (bMissing) return -1;
  const diff = ascending ? aDate - bDate : bDate - aDate;
  return diff || a.name.localeCompare(b.name, "zh-CN") || a.id.localeCompare(b.id);
}`,
    "customer name date helpers"
  );
}

if (!source.includes('customerSort === "name_date_asc"')) {
  source = replaceOnce(
    source,
    '    if (customerSort !== "created_asc") return filtered;',
    '    if (customerSort === "name_date_asc") {\n      return [...filtered].sort((a, b) => compareCustomerNameDate(a, b, true));\n    }\n\n    if (customerSort === "name_date_desc") {\n      return [...filtered].sort((a, b) => compareCustomerNameDate(a, b, false));\n    }\n\n    if (customerSort !== "created_asc") return filtered;',
    "customer name date sort memo"
  );
}

if (!source.includes('value="name_date_asc"')) {
  source = replaceOnce(
    source,
    '          <option value="">默认排序：最近更新</option>\n          <option value="created_asc">创建日期：最早优先</option>',
    '          <option value="">默认排序：最近更新</option>\n          <option value="name_date_asc">姓名日期：最早优先</option>\n          <option value="name_date_desc">姓名日期：最晚优先</option>\n          <option value="created_asc">创建日期：最早优先</option>',
    "customer name date sort options"
  );
}

writeFileSync(appPath, source);
