import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) {
    console.warn(`Skipping ${label}; pattern not found`);
    return source;
  }
  return source.replace(search, replacement);
}

function replaceBetween(source, startMarker, endMarker, replacement, label) {
  if (source.includes("monthlyMaxOrderAmount")) return source;
  const start = source.indexOf(startMarker);
  if (start === -1) {
    console.warn(`Skipping ${label}; start marker not found`);
    return source;
  }
  const end = source.indexOf(endMarker, start);
  if (end === -1) {
    console.warn(`Skipping ${label}; end marker not found`);
    return source;
  }
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

const typesPath = new URL("../src/types.ts", import.meta.url);
let typesSource = readFileSync(typesPath, "utf8");
typesSource = replaceOnce(
  typesSource,
  `  monthlyRevenue: number;
  pendingPaymentAmount: number;`,
  `  monthlyRevenue: number;
  monthlyMaxOrderAmount: number;
  monthlyMinOrderAmount: number;
  paidOrderCount: number;
  paidAverageOrderAmount: number;
  pendingPaymentAmount: number;`,
  "statistics type fields"
);
writeFileSync(typesPath, typesSource);

const apiPath = new URL("../netlify/functions/api.ts", import.meta.url);
let apiSource = readFileSync(apiPath, "utf8");
apiSource = replaceBetween(
  apiSource,
  "async function handleStatistics(",
  "\nasync function handleExport(",
  `async function handleStatistics(pathname: string, query: Query, request: Request): Promise<HandlerResult> {
  if (pathname !== "/api/statistics" || request.method !== "GET") return null;
  const month = query.month || new Date().toISOString().slice(0, 7);
  const orders = await fetchMappedOrders();
  const monthlyOrders = orders.filter((order) => order.createdAt.slice(0, 7) === month);
  const monthlyOrderAmounts = monthlyOrders.map((order) => {
    const amount = Number(order.amount || 0);
    return Number.isFinite(amount) ? amount : 0;
  });
  const paidMonthlyOrders = orders.filter(
    (order) => order.paymentStatus === "已支付" && order.paymentDate?.slice(0, 7) === month
  );
  const monthlyRevenue = paidMonthlyOrders.reduce((sum, order) => sum + order.amount, 0);
  const paidOrdersByCustomer = new Map<string, Order[]>();
  orders
    .filter((order) => order.paymentStatus === "已支付")
    .forEach((order) => {
      paidOrdersByCustomer.set(order.customerId, [...(paidOrdersByCustomer.get(order.customerId) || []), order]);
    });
  const data: StatisticsData = {
    monthlyOrderCount: monthlyOrders.length,
    monthlyRevenue,
    monthlyMaxOrderAmount: monthlyOrderAmounts.length ? Math.max(...monthlyOrderAmounts) : 0,
    monthlyMinOrderAmount: monthlyOrderAmounts.length ? Math.min(...monthlyOrderAmounts) : 0,
    paidOrderCount: paidMonthlyOrders.length,
    paidAverageOrderAmount: paidMonthlyOrders.length ? monthlyRevenue / paidMonthlyOrders.length : 0,
    pendingPaymentAmount: orders
      .filter((order) => order.orderStatus === "待支付" && order.paymentStatus !== "已退款")
      .reduce((sum, order) => sum + order.amount, 0),
    logisticsExceptionOrderCount: orders.filter((order) => order.orderStatus === "物流异常" || order.logisticsStatus === "异常").length,
    signedNeedFollowupCount: orders.filter((order) => order.orderStatus === "已签收待回访").length,
    repeatCustomerCount: Array.from(paidOrdersByCustomer.values()).filter(
      (customerOrders) =>
        customerOrders.length >= 2 && customerOrders.some((order) => order.paymentDate?.slice(0, 7) === month)
    ).length
  };
  return data as unknown as Record<string, unknown>;
}
`,
  "statistics handler"
);
writeFileSync(apiPath, apiSource);

const appPath = new URL("../src/App.tsx", import.meta.url);
let appSource = readFileSync(appPath, "utf8");
appSource = replaceOnce(
  appSource,
  `    { label: "本月订单数量", value: statistics?.monthlyOrderCount ?? 0 },
    { label: "本月成交金额（美元）", value: formatMoney(statistics?.monthlyRevenue ?? 0) },
    { label: "待支付金额（美元）", value: formatMoney(statistics?.pendingPaymentAmount ?? 0) },`,
  `    { label: "本月订单数量", value: statistics?.monthlyOrderCount ?? 0 },
    { label: "本月成交金额（美元）", value: formatMoney(statistics?.monthlyRevenue ?? 0) },
    { label: "本月最大一笔订单金额（美元）", value: formatMoney(statistics?.monthlyMaxOrderAmount ?? 0) },
    { label: "本月最小一笔订单金额（美元）", value: formatMoney(statistics?.monthlyMinOrderAmount ?? 0) },
    { label: "已付款订单数", value: statistics?.paidOrderCount ?? 0 },
    { label: "已付款平均单价（美元）", value: formatMoney(statistics?.paidAverageOrderAmount ?? 0) },
    { label: "待支付金额（美元）", value: formatMoney(statistics?.pendingPaymentAmount ?? 0) },`,
  "statistics metric cards"
);
writeFileSync(appPath, appSource);
