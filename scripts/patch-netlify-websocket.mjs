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

function amountValue(order: Order) {
  const amount = Number(order.amount || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function sortOrders(orders: Order[], sort: string | undefined) {
  const sorted = [...orders];
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

source = replaceOnce(
  source,
  "  return filtered;\n}\n\nasync function fetchMappedOrders",
  "  return sortOrders(filtered, query.sort);\n}\n\nasync function fetchMappedOrders",
  "order sort return"
);

writeFileSync(apiPath, source);

const appPath = new URL("../src/App.tsx", import.meta.url);
let appSource = readFileSync(appPath, "utf8");

appSource = replaceOnce(
  appSource,
  '    followupTo: ""\n  });',
  '    followupTo: "",\n    sort: ""\n  });',
  "order filter sort state"
);

appSource = replaceOnce(
  appSource,
  '    if (orderFilters.followupTo) params.set("followupTo", `${orderFilters.followupTo}T23:59`);\n    return params.toString();',
  '    if (orderFilters.followupTo) params.set("followupTo", `${orderFilters.followupTo}T23:59`);\n    if (orderFilters.sort) params.set("sort", orderFilters.sort);\n    return params.toString();',
  "order sort query param"
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
            <option value="followup_asc">回访时间：最近优先</option>
            <option value="followup_desc">回访时间：最晚优先</option>
            <option value="amount_desc">金额：高到低</option>
            <option value="amount_asc">金额：低到高</option>
          </select>
        </div>
        <button className="primary-button" onClick={onAdd} disabled={customers.length === 0}>`,
  "order sort select"
);

writeFileSync(appPath, appSource);
