import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) {
    console.warn(`Skipping ${label}; pattern not found`);
    return source;
  }
  return source.replace(search, replacement);
}

const apiPath = new URL("../netlify/functions/api.ts", import.meta.url);
let source = readFileSync(apiPath, "utf8");

if (!source.includes('import { WebSocket as NodeWebSocket } from "ws";')) {
  source = source.replace(
    'import { createClient } from "@supabase/supabase-js";',
    'import { createClient } from "@supabase/supabase-js";\nimport { WebSocket as NodeWebSocket } from "ws";'
  );
}

source = source.replace(
  'return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SECRET_KEY"), {\n    auth: {\n      persistSession: false,\n      autoRefreshToken: false\n    }\n  });',
  'return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SECRET_KEY"), {\n    auth: {\n      persistSession: false,\n      autoRefreshToken: false\n    },\n    realtime: {\n      transport: NodeWebSocket as never\n    }\n  });'
);

if (!source.includes("function sortOrders(")) {
  source = replaceOnce(
    source,
    "function applyOrderFilters(orders: Order[], query: Query) {",
    `function dateTime(value: string | null | undefined) {
  if (!value) return Number.NaN;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.NaN;
}

function compareUpdatedDesc(a: Order, b: Order) {
  const aTime = dateTime(a.updatedAt);
  const bTime = dateTime(b.updatedAt);
  if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return bTime - aTime;
  if (Number.isFinite(aTime) && !Number.isFinite(bTime)) return -1;
  if (!Number.isFinite(aTime) && Number.isFinite(bTime)) return 1;
  return a.id.localeCompare(b.id);
}

function compareFollowUp(a: Order, b: Order, ascending: boolean) {
  const aTime = dateTime(a.nextFollowUpAt);
  const bTime = dateTime(b.nextFollowUpAt);
  const aMissing = !Number.isFinite(aTime);
  const bMissing = !Number.isFinite(bTime);
  if (aMissing && bMissing) return compareUpdatedDesc(a, b);
  if (aMissing) return 1;
  if (bMissing) return -1;
  const diff = ascending ? aTime - bTime : bTime - aTime;
  return diff || compareUpdatedDesc(a, b);
}

function compareLastContact(a: Order, b: Order) {
  const aTime = dateTime(a.lastContactAt);
  const bTime = dateTime(b.lastContactAt);
  const aMissing = !Number.isFinite(aTime);
  const bMissing = !Number.isFinite(bTime);
  if (aMissing && bMissing) return compareUpdatedDesc(a, b);
  if (aMissing) return 1;
  if (bMissing) return -1;
  return aTime - bTime || compareUpdatedDesc(a, b);
}

function amountValue(order: Order) {
  const amount = Number(order.amount || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function sortOrders(orders: Order[], sort: string | undefined) {
  const sorted = [...orders];
  if (sort === "last_contact_asc") return sorted.sort(compareLastContact);
  if (sort === "followup_asc") return sorted.sort((a, b) => compareFollowUp(a, b, true));
  if (sort === "followup_desc") return sorted.sort((a, b) => compareFollowUp(a, b, false));
  if (sort === "amount_desc") return sorted.sort((a, b) => amountValue(b) - amountValue(a) || compareUpdatedDesc(a, b));
  if (sort === "amount_asc") return sorted.sort((a, b) => amountValue(a) - amountValue(b) || compareUpdatedDesc(a, b));
  return sorted;
}

function applyOrderFilters(orders: Order[], query: Query) {`,
    "order sort helpers"
  );
}

if (!source.includes("function compareLastContact(")) {
  source = replaceOnce(
    source,
    "function amountValue(order: Order) {",
    `function compareLastContact(a: Order, b: Order) {
  const aTime = dateTime(a.lastContactAt);
  const bTime = dateTime(b.lastContactAt);
  const aMissing = !Number.isFinite(aTime);
  const bMissing = !Number.isFinite(bTime);
  if (aMissing && bMissing) return compareUpdatedDesc(a, b);
  if (aMissing) return 1;
  if (bMissing) return -1;
  return aTime - bTime || compareUpdatedDesc(a, b);
}

function amountValue(order: Order) {`,
    "last contact comparator"
  );
}

source = replaceOnce(
  source,
  '  if (sort === "followup_asc") return sorted.sort((a, b) => compareFollowUp(a, b, true));',
  '  if (sort === "last_contact_asc") return sorted.sort(compareLastContact);\n  if (sort === "followup_asc") return sorted.sort((a, b) => compareFollowUp(a, b, true));',
  "last contact sort branch"
);

source = replaceOnce(
  source,
  "  if (query.status) filtered = filtered.filter((order) => order.orderStatus === query.status);\n  if (query.country) filtered = filtered.filter((order) => order.country === query.country);",
  "  if (query.status) filtered = filtered.filter((order) => order.orderStatus === query.status);\n  if (query.customerName?.trim()) {\n    const customerName = query.customerName.trim().toLowerCase();\n    filtered = filtered.filter((order) => order.customerName.toLowerCase().includes(customerName));\n  }\n  if (query.country) filtered = filtered.filter((order) => order.country === query.country);",
  "customer name order filter"
);

source = replaceOnce(
  source,
  "  return filtered;\n}\n\nasync function fetchMappedOrders",
  "  return sortOrders(filtered, query.sort);\n}\n\nasync function fetchMappedOrders",
  "order sort return"
);

writeFileSync(apiPath, source);

const utilsPath = new URL("../src/utils.ts", import.meta.url);
let utilsSource = readFileSync(utilsPath, "utf8");

utilsSource = utilsSource.replace('new Intl.NumberFormat("zh-CN"', 'new Intl.NumberFormat("en-US"');
utilsSource = utilsSource.replace('currency: "CNY"', 'currency: "USD"');

writeFileSync(utilsPath, utilsSource);

const appPath = new URL("../src/App.tsx", import.meta.url);
let appSource = readFileSync(appPath, "utf8");

appSource = replaceOnce(
  appSource,
  '    followupTo: ""\n  });',
  '    followupTo: "",\n    customerName: "",\n    sort: ""\n  });',
  "order filter customer search and sort state"
);

appSource = replaceOnce(
  appSource,
  '    if (orderFilters.followupTo) params.set("followupTo", `${orderFilters.followupTo}T23:59`);\n    return params.toString();',
  '    if (orderFilters.followupTo) params.set("followupTo", `${orderFilters.followupTo}T23:59`);\n    if (orderFilters.customerName.trim()) params.set("customerName", orderFilters.customerName.trim());\n    if (orderFilters.sort) params.set("sort", orderFilters.sort);\n    return params.toString();',
  "order customer search and sort query params"
);

appSource = replaceOnce(
  appSource,
  "    followupFrom: string;\n    followupTo: string;\n  };\n  onFiltersChange",
  "    followupFrom: string;\n    followupTo: string;\n    sort: string;\n  };\n  onFiltersChange",
  "order filter prop sort type"
);

appSource = replaceOnce(
  appSource,
  "    followupFrom: string;\n    followupTo: string;\n  }) => void;",
  "    followupFrom: string;\n    followupTo: string;\n    sort: string;\n  }) => void;",
  "order filter callback sort type"
);

if (!appSource.includes('customerName: ""')) {
  appSource = replaceOnce(
    appSource,
    '    status: "",\n    country: ""',
    '    status: "",\n    customerName: "",\n    country: ""',
    "order filter customer search state"
  );
}

if (!appSource.includes('params.set("customerName"')) {
  appSource = replaceOnce(
    appSource,
    '    if (activePage === "orders" && orderFilters.status) params.set("status", orderFilters.status);\n    if (orderFilters.country)',
    '    if (activePage === "orders" && orderFilters.status) params.set("status", orderFilters.status);\n    if (orderFilters.customerName.trim()) params.set("customerName", orderFilters.customerName.trim());\n    if (orderFilters.country)',
    "order customer search query param"
  );
}

appSource = appSource.replaceAll(
  "    status: string;\n    country: string;",
  "    status: string;\n    customerName: string;\n    country: string;"
);

if (!appSource.includes('placeholder="搜索客户姓名"')) {
  appSource = replaceOnce(
    appSource,
    `        <div className="filter-grid">
          {page === "orders" && (`,
    `        <div className="filter-grid">
          <label className="search-box">
            <Search size={17} />
            <input
              value={filters.customerName}
              onChange={(event) => onFiltersChange({ ...filters, customerName: event.target.value })}
              placeholder="搜索客户姓名"
            />
          </label>
          {page === "orders" && (`,
    "order customer search input"
  );
}

if (!appSource.includes('value="last_contact_asc"')) {
  appSource = replaceOnce(
    appSource,
    '            <option value="">默认排序：最近更新</option>\n            <option value="followup_asc">',
    '            <option value="">默认排序：最近更新</option>\n            <option value="last_contact_asc">最后联系时间：最早优先</option>\n            <option value="followup_asc">',
    "last contact sort option"
  );
}

appSource = replaceOnce(
  appSource,
  `              <td>
                <strong>{order.customerName}</strong>
                <small>{order.customerContact || "-"}</small>
              </td>`,
  `              <td>
                <small>最后联系：{formatDate(order.lastContactAt)}</small>
                <strong>{order.customerName}</strong>
                <small>{order.customerContact || "-"}</small>
              </td>`,
  "order customer last contact display"
);

appSource = replaceOnce(
  appSource,
  `            {LOGISTICS_STATUSES.map((status) => (
              <option value={status} key={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <button className="primary-button" onClick={onAdd} disabled={customers.length === 0}>`,
  `            {LOGISTICS_STATUSES.map((status) => (
              <option value={status} key={status}>
                {status}
              </option>
            ))}
          </select>
          <select value={filters.sort} onChange={(event) => onFiltersChange({ ...filters, sort: event.target.value })}>
            <option value="">默认排序：最近更新</option>
            <option value="last_contact_asc">最后联系时间：最早优先</option>
            <option value="followup_asc">回访时间：最近优先</option>
            <option value="followup_desc">回访时间：最晚优先</option>
            <option value="amount_desc">金额（美元）：高到低</option>
            <option value="amount_asc">金额（美元）：低到高</option>
          </select>
        </div>
        <button className="primary-button" onClick={onAdd} disabled={customers.length === 0}>`,
  "order sort select"
);

if (!appSource.includes("const [customerSort, setCustomerSort]")) {
  appSource = replaceOnce(
    appSource,
    '  const [search, setSearch] = useState("");',
    '  const [search, setSearch] = useState("");\n  const [customerSort, setCustomerSort] = useState("");',
    "customer sort state"
  );

  appSource = replaceOnce(
    appSource,
    `  const visibleCustomers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.contact, customer.country, customer.source, customer.tags.join(","), customer.notes]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [customers, search]);`,
    `  const visibleCustomers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const filtered = keyword
      ? customers.filter((customer) =>
          [customer.name, customer.contact, customer.country, customer.source, customer.tags.join(","), customer.notes]
            .join(" ")
            .toLowerCase()
            .includes(keyword)
        )
      : customers;

    if (customerSort !== "created_asc") return filtered;

    return [...filtered].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      const aMissing = !Number.isFinite(aTime);
      const bMissing = !Number.isFinite(bTime);
      if (aMissing && bMissing) return a.name.localeCompare(b.name, "zh-CN") || a.id.localeCompare(b.id);
      if (aMissing) return 1;
      if (bMissing) return -1;
      return aTime - bTime || a.name.localeCompare(b.name, "zh-CN") || a.id.localeCompare(b.id);
    });
  }, [customers, search, customerSort]);`,
    "customer sort memo"
  );

  appSource = replaceOnce(
    appSource,
    `        <label className="search-box">
          <Search size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索客户" />
        </label>
        <button className="primary-button" onClick={onAdd}>`,
    `        <label className="search-box">
          <Search size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索客户" />
        </label>
        <select value={customerSort} onChange={(event) => setCustomerSort(event.target.value)} aria-label="客户排序">
          <option value="">默认排序：最近更新</option>
          <option value="created_asc">创建日期：最早优先</option>
        </select>
        <button className="primary-button" onClick={onAdd}>`,
    "customer sort select"
  );
}

appSource = replaceOnce(appSource, "                <th>订单数</th>", "                <th>订单数</th>\n                <th>创建日期</th>", "customer created header");
appSource = replaceOnce(appSource, "                  <td>{customer.ordersCount}</td>", "                  <td>{customer.ordersCount}</td>\n                  <td>{formatDate(customer.createdAt)}</td>", "customer created cell");
appSource = appSource.replace("金额：高到低", "金额（美元）：高到低");
appSource = appSource.replace("金额：低到高", "金额（美元）：低到高");
appSource = appSource.replace("<th>金额</th>", "<th>金额（美元）</th>");
appSource = appSource.replace('"本月成交金额"', '"本月成交金额（美元）"');
appSource = appSource.replace('"待支付金额"', '"待支付金额（美元）"');
appSource = appSource.replace("          订单金额\n", "          订单金额（美元）\n");

writeFileSync(appPath, appSource);
