import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  Communication,
  Customer,
  CustomerDetail,
  DashboardData,
  DictionaryOption,
  Order,
  StatisticsData,
  User
} from "../../src/types";

type JsonBody = Record<string, unknown>;
type Query = Record<string, string>;
type ApiError = Error & { status?: number };
type HandlerResult = Response | Record<string, unknown> | null;

type DbCustomer = {
  id: string;
  name: string;
  contact: string;
  country: string;
  source: string;
  tags: string[];
  notes: string;
  created_at: string;
  updated_at: string;
};

type DbOrder = {
  id: string;
  customer_id: string;
  product: string;
  amount: number | string;
  payment_status: string;
  payment_date: string | null;
  order_status: string;
  tracking_number: string | null;
  logistics_company: string | null;
  logistics_status: string | null;
  logistics_updated_at: string | null;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

type DbCommunication = {
  id: string;
  customer_id: string;
  order_id: string | null;
  communicated_at: string;
  content: string;
  next_follow_up_at: string | null;
  follower_note: string;
  created_at: string;
  updated_at: string;
};

type DbOption = {
  id: string;
  category: DictionaryOption["category"];
  value: string;
  sort_order: number;
};

const SESSION_COOKIE = "customer_followup_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const TEAM_USER: User = {
  id: "team",
  username: "team",
  displayName: "团队成员"
};

export const config: Config = {
  path: "/api/*"
};

function env(name: string) {
  const netlifyValue = (
    globalThis as typeof globalThis & { Netlify?: { env?: { get(name: string): string | undefined } } }
  ).Netlify?.env?.get(name);
  return netlifyValue || process.env[name] || "";
}

function fail(message: string, status = 400): never {
  const error = new Error(message) as ApiError;
  error.status = status;
  throw error;
}

function requiredEnv(name: string) {
  const value = env(name).trim();
  if (!value) fail(`缺少 Netlify 环境变量：${name}`, 500);
  return value;
}

function supabase() {
  return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SECRET_KEY"), {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

async function unwrap<T>(request: PromiseLike<{ data: T; error: { message: string } | null }>) {
  const { data, error } = await request;
  if (error) fail(error.message);
  return data;
}

function parsePath(request: Request) {
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams.entries());
  return { pathname: url.pathname, query };
}

async function bodyOf(request: Request): Promise<JsonBody> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as JsonBody;
  } catch {
    fail("请求内容不是有效 JSON");
  }
}

function nullableText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

function nullableDate(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function requireString(value: unknown, message: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) fail(message);
  return text;
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function hmac(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function signedPassword(value: string, secret: string) {
  return hmac(`password:${value}`, secret);
}

function createSessionCookie(request: Request) {
  const secret = requiredEnv("SESSION_SECRET");
  const payload = Buffer.from(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
      iat: Math.floor(Date.now() / 1000)
    })
  ).toString("base64url");
  const token = `${payload}.${hmac(payload, secret)}`;
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

function readCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") || "";
  return cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function hasValidSession(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  if (!safeCompare(signature, hmac(payload, requiredEnv("SESSION_SECRET")))) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: unknown };
    return typeof parsed.exp === "number" && parsed.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function requireSession(request: Request) {
  if (!hasValidSession(request)) fail("请先输入团队访问密码", 401);
}

function computeOrderAlert(order: DbOrder | Order) {
  const reasons: string[] = [];
  let level: Order["alertLevel"] = null;
  const status = "order_status" in order ? order.order_status : order.orderStatus;
  const paymentStatus = "payment_status" in order ? order.payment_status : order.paymentStatus;
  const trackingNumber = "tracking_number" in order ? order.tracking_number : order.trackingNumber;
  const paymentDate = "payment_date" in order ? order.payment_date : order.paymentDate;
  const updatedAt = "updated_at" in order ? order.updated_at : order.updatedAt;
  const createdAt = "created_at" in order ? order.created_at : order.createdAt;
  const lastContactAt = "last_contact_at" in order ? order.last_contact_at : order.lastContactAt;
  const logisticsUpdatedAt =
    "logistics_updated_at" in order ? order.logistics_updated_at : order.logisticsUpdatedAt;

  const hoursSince = (value: string | null | undefined) => {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? (Date.now() - time) / (60 * 60 * 1000) : 0;
  };

  if (status === "待支付" && hoursSince(lastContactAt || createdAt) > 24) {
    level = "yellow";
    reasons.push("待支付超过24小时未跟进");
  }
  if (paymentStatus === "已支付" && status !== "已完成" && !trackingNumber && hoursSince(paymentDate || updatedAt) > 48) {
    level = "red";
    reasons.push("已支付超过2天未填写物流单号");
  }
  if (status === "物流追踪中" && hoursSince(logisticsUpdatedAt) > 72) {
    level = "red";
    reasons.push("物流追踪超过3天没有更新");
  }

  return { level, reasons };
}

function mapCustomer(row: DbCustomer, orders: DbOrder[] = []): Customer {
  return {
    id: row.id,
    name: row.name,
    contact: row.contact || "",
    country: row.country || "",
    source: row.source || "",
    tags: row.tags || [],
    notes: row.notes || "",
    ordersCount: orders.filter((order) => order.customer_id === row.id).length,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapOrder(row: DbOrder, customer?: DbCustomer | Customer): Order {
  const alert = computeOrderAlert(row);
  const customerTags = customer && "tags" in customer ? customer.tags || [] : [];
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: customer?.name || "",
    customerContact: customer?.contact || "",
    country: customer?.country || "",
    source: customer?.source || "",
    customerTags,
    product: row.product || "",
    amount: Number(row.amount || 0),
    paymentStatus: row.payment_status,
    paymentDate: row.payment_date,
    orderStatus: row.order_status,
    trackingNumber: row.tracking_number,
    logisticsCompany: row.logistics_company,
    logisticsStatus: row.logistics_status,
    logisticsUpdatedAt: row.logistics_updated_at,
    lastContactAt: row.last_contact_at,
    nextFollowUpAt: row.next_follow_up_at,
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    alertLevel: alert.level,
    alertReasons: alert.reasons
  };
}

function mapCommunication(row: DbCommunication): Communication {
  return {
    id: row.id,
    customerId: row.customer_id,
    orderId: row.order_id,
    communicatedAt: row.communicated_at,
    content: row.content,
    nextFollowUpAt: row.next_follow_up_at,
    followerNote: row.follower_note || "",
    createdByName: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function optionMap(row: DbOption): DictionaryOption {
  return {
    id: row.id,
    category: row.category,
    value: row.value,
    sortOrder: row.sort_order
  };
}

async function fetchCustomersRaw() {
  return unwrap(
    supabase()
      .from("customers")
      .select("*")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .returns<DbCustomer[]>()
  );
}

async function fetchOrdersRaw() {
  return unwrap(
    supabase()
      .from("orders")
      .select("*")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .returns<DbOrder[]>()
  );
}

async function fetchOptionsRaw(category?: string) {
  let query = supabase()
    .from("settings_options")
    .select("*")
    .is("deleted_at", null)
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("value", { ascending: true });
  if (category) query = query.eq("category", category);
  return unwrap(query.returns<DbOption[]>());
}

function applyOrderFilters(orders: Order[], query: Query) {
  let filtered = [...orders];
  if (query.status) filtered = filtered.filter((order) => order.orderStatus === query.status);
  if (query.country) filtered = filtered.filter((order) => order.country === query.country);
  if (query.tag) filtered = filtered.filter((order) => order.customerTags.includes(query.tag));
  if (query.logisticsStatus) filtered = filtered.filter((order) => order.logisticsStatus === query.logisticsStatus);
  if (query.trackingMissing === "1") {
    filtered = filtered.filter(
      (order) => order.paymentStatus === "已支付" && !order.trackingNumber && order.orderStatus !== "已完成"
    );
  }
  if (query.exception === "1") {
    filtered = filtered.filter((order) => order.orderStatus === "物流异常" || order.logisticsStatus === "异常");
  }
  if (query.followup === "due") {
    filtered = filtered.filter(
      (order) => order.nextFollowUpAt && new Date(order.nextFollowUpAt).getTime() <= Date.now() && order.orderStatus !== "已完成"
    );
  }
  if (query.followup === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    filtered = filtered.filter((order) => {
      if (!order.nextFollowUpAt) return false;
      const time = new Date(order.nextFollowUpAt).getTime();
      return time >= start.getTime() && time <= end.getTime();
    });
  }
  if (query.followup === "none") {
    filtered = filtered.filter((order) => !order.nextFollowUpAt);
  }
  if (query.followupFrom) {
    filtered = filtered.filter(
      (order) => order.nextFollowUpAt && new Date(order.nextFollowUpAt) >= new Date(query.followupFrom)
    );
  }
  if (query.followupTo) {
    filtered = filtered.filter(
      (order) => order.nextFollowUpAt && new Date(order.nextFollowUpAt) <= new Date(query.followupTo)
    );
  }
  return filtered;
}

async function fetchMappedOrders(query: Query = {}) {
  const [customers, orders] = await Promise.all([fetchCustomersRaw(), fetchOrdersRaw()]);
  const activeCustomerIds = new Set(customers.map((customer) => customer.id));
  const mapped = orders
    .filter((order) => activeCustomerIds.has(order.customer_id))
    .map((order) => mapOrder(order, customers.find((customer) => customer.id === order.customer_id)));
  return applyOrderFilters(mapped, query);
}

async function handleAuth(pathname: string, request: Request): Promise<HandlerResult> {
  if (pathname === "/api/auth/login" && request.method === "POST") {
    const body = await bodyOf(request);
    const password = requireString(body.password, "团队访问密码不能为空");
    const appPassword = requiredEnv("APP_ACCESS_PASSWORD");
    const secret = requiredEnv("SESSION_SECRET");
    if (!safeCompare(signedPassword(password, secret), signedPassword(appPassword, secret))) {
      fail("团队访问密码错误", 401);
    }
    return Response.json(
      { user: TEAM_USER },
      {
        headers: {
          "Set-Cookie": createSessionCookie(request)
        }
      }
    );
  }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    return Response.json(
      { ok: true },
      {
        headers: {
          "Set-Cookie": clearSessionCookie()
        }
      }
    );
  }

  if (pathname === "/api/auth/me" && request.method === "GET") {
    requireSession(request);
    return { user: TEAM_USER };
  }

  return null;
}

async function handleCustomers(pathname: string, query: Query, request: Request): Promise<HandlerResult> {
  const customerMatch = pathname.match(/^\/api\/customers\/([^/]+)$/);
  const communicationsMatch = pathname.match(/^\/api\/customers\/([^/]+)\/communications$/);

  if (pathname === "/api/customers" && request.method === "GET") {
    const [customers, orders] = await Promise.all([fetchCustomersRaw(), fetchOrdersRaw()]);
    let mapped = customers.map((customer) => mapCustomer(customer, orders));
    if (query.search) {
      const search = query.search.toLowerCase();
      mapped = mapped.filter((customer) => JSON.stringify(customer).toLowerCase().includes(search));
    }
    if (query.country) mapped = mapped.filter((customer) => customer.country === query.country);
    if (query.source) mapped = mapped.filter((customer) => customer.source === query.source);
    if (query.tag) mapped = mapped.filter((customer) => customer.tags.includes(query.tag));
    return { customers: mapped };
  }

  if (pathname === "/api/customers" && request.method === "POST") {
    const body = await bodyOf(request);
    const payload = {
      name: requireString(body.name, "客户姓名不能为空"),
      contact: String(body.contact || ""),
      country: String(body.country || ""),
      source: String(body.source || ""),
      tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
      notes: String(body.notes || "")
    };
    const row = (await unwrap(supabase().from("customers").insert(payload).select("*").single())) as DbCustomer;
    return { customer: mapCustomer(row) };
  }

  if (customerMatch && request.method === "GET") {
    const customerId = customerMatch[1];
    const [customers, orders, communications] = await Promise.all([
      fetchCustomersRaw(),
      fetchOrdersRaw(),
      unwrap(
        supabase()
          .from("communications")
          .select("*")
          .eq("customer_id", customerId)
          .is("deleted_at", null)
          .order("communicated_at", { ascending: false })
          .returns<DbCommunication[]>()
      )
    ]);
    const customer = customers.find((item) => item.id === customerId);
    if (!customer) fail("客户不存在", 404);
    const customerOrders = orders.filter((order) => order.customer_id === customerId);
    return {
      customer: mapCustomer(customer, orders),
      orders: customerOrders.map((order) => mapOrder(order, customer)),
      communications: communications.map(mapCommunication)
    } satisfies CustomerDetail;
  }

  if (customerMatch && request.method === "PATCH") {
    const customerId = customerMatch[1];
    const body = await bodyOf(request);
    const payload = {
      name: requireString(body.name, "客户姓名不能为空"),
      contact: String(body.contact || ""),
      country: String(body.country || ""),
      source: String(body.source || ""),
      tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
      notes: String(body.notes || "")
    };
    const row = (await unwrap(
      supabase().from("customers").update(payload).eq("id", customerId).select("*").single()
    )) as DbCustomer;
    return { customer: mapCustomer(row) };
  }

  if (customerMatch && request.method === "DELETE") {
    const customerId = customerMatch[1];
    const now = new Date().toISOString();
    await unwrap(
      supabase().from("communications").update({ deleted_at: now }).eq("customer_id", customerId).is("deleted_at", null)
    );
    await unwrap(supabase().from("orders").update({ deleted_at: now }).eq("customer_id", customerId).is("deleted_at", null));
    await unwrap(supabase().from("customers").update({ deleted_at: now }).eq("id", customerId).is("deleted_at", null));
    return { ok: true };
  }

  if (communicationsMatch && request.method === "GET") {
    const customerId = communicationsMatch[1];
    const communications = await unwrap(
      supabase()
        .from("communications")
        .select("*")
        .eq("customer_id", customerId)
        .is("deleted_at", null)
        .order("communicated_at", { ascending: false })
        .returns<DbCommunication[]>()
    );
    return { communications: communications.map(mapCommunication) };
  }

  if (communicationsMatch && request.method === "POST") {
    const customerId = communicationsMatch[1];
    const body = await bodyOf(request);
    const communicatedAt = nullableDate(body.communicatedAt ?? body.communicated_at) || new Date().toISOString();
    const nextFollowUpAt = nullableDate(body.nextFollowUpAt ?? body.next_follow_up_at);
    const orderId = nullableText(body.orderId ?? body.order_id);
    const row = (await unwrap(
      supabase()
        .from("communications")
        .insert({
          customer_id: customerId,
          order_id: orderId,
          communicated_at: communicatedAt,
          content: requireString(body.content, "沟通内容不能为空"),
          next_follow_up_at: nextFollowUpAt,
          follower_note: String(body.followerNote ?? body.follower_note ?? "")
        })
        .select("*")
        .single()
    )) as DbCommunication;

    const updatePayload: Record<string, string> = { last_contact_at: communicatedAt };
    if (nextFollowUpAt) updatePayload.next_follow_up_at = nextFollowUpAt;
    let orderUpdate = supabase().from("orders").update(updatePayload).eq("customer_id", customerId).is("deleted_at", null);
    if (orderId) orderUpdate = orderUpdate.eq("id", orderId);
    await unwrap(orderUpdate);

    return { id: row.id };
  }

  return null;
}

function orderPayload(body: JsonBody, existing?: DbOrder) {
  const trackingNumber = nullableText(body.trackingNumber ?? body.tracking_number ?? existing?.tracking_number);
  const logisticsCompany = nullableText(body.logisticsCompany ?? body.logistics_company ?? existing?.logistics_company);
  const logisticsStatus = nullableText(body.logisticsStatus ?? body.logistics_status ?? existing?.logistics_status);
  let orderStatus = String(body.orderStatus ?? body.order_status ?? existing?.order_status ?? "待沟通");
  if (logisticsStatus === "已签收" && orderStatus !== "已完成") orderStatus = "已签收待回访";
  const logisticsChanged =
    !existing ||
    existing.tracking_number !== trackingNumber ||
    existing.logistics_company !== logisticsCompany ||
    existing.logistics_status !== logisticsStatus;

  return {
    customer_id: requireString(body.customerId ?? body.customer_id ?? existing?.customer_id, "请选择有效客户"),
    product: String(body.product ?? existing?.product ?? ""),
    amount: Number(body.amount ?? existing?.amount ?? 0),
    payment_status: String(body.paymentStatus ?? body.payment_status ?? existing?.payment_status ?? "未支付"),
    payment_date: nullableDate(body.paymentDate ?? body.payment_date ?? existing?.payment_date),
    order_status: orderStatus,
    tracking_number: trackingNumber,
    logistics_company: logisticsCompany,
    logistics_status: logisticsStatus,
    logistics_updated_at: logisticsChanged ? new Date().toISOString() : existing?.logistics_updated_at ?? null,
    last_contact_at: nullableDate(body.lastContactAt ?? body.last_contact_at ?? existing?.last_contact_at),
    next_follow_up_at: nullableDate(body.nextFollowUpAt ?? body.next_follow_up_at ?? existing?.next_follow_up_at),
    notes: String(body.notes ?? existing?.notes ?? "")
  };
}

async function handleOrders(pathname: string, query: Query, request: Request): Promise<HandlerResult> {
  const orderMatch = pathname.match(/^\/api\/orders\/([^/]+)$/);

  if (pathname === "/api/orders" && request.method === "GET") {
    return { orders: await fetchMappedOrders(query) };
  }
  if (pathname === "/api/orders" && request.method === "POST") {
    const payload = orderPayload(await bodyOf(request));
    const row = (await unwrap(supabase().from("orders").insert(payload).select("*").single())) as DbOrder;
    const customers = await fetchCustomersRaw();
    return { order: mapOrder(row, customers.find((customer) => customer.id === row.customer_id)) };
  }
  if (orderMatch && request.method === "PATCH") {
    const orderId = orderMatch[1];
    const existing = (await unwrap(supabase().from("orders").select("*").eq("id", orderId).single())) as DbOrder;
    const row = (await unwrap(
      supabase().from("orders").update(orderPayload(await bodyOf(request), existing)).eq("id", orderId).select("*").single()
    )) as DbOrder;
    const customers = await fetchCustomersRaw();
    return { order: mapOrder(row, customers.find((customer) => customer.id === row.customer_id)) };
  }
  if (orderMatch && request.method === "DELETE") {
    await unwrap(supabase().from("orders").update({ deleted_at: new Date().toISOString() }).eq("id", orderMatch[1]));
    return { ok: true };
  }
  return null;
}

async function handleSettings(pathname: string, query: Query, request: Request): Promise<HandlerResult> {
  const optionMatch = pathname.match(/^\/api\/settings\/options\/([^/]+)$/);

  if (pathname === "/api/settings/options" && request.method === "GET") {
    const rows = await fetchOptionsRaw(query.category);
    return { options: rows.map(optionMap) };
  }
  if (pathname === "/api/settings/options" && request.method === "POST") {
    const body = await bodyOf(request);
    const row = (await unwrap(
      supabase()
        .from("settings_options")
        .insert({
          category: requireString(body.category, "请选择字典分类"),
          value: requireString(body.value, "选项内容不能为空"),
          sort_order: Number(body.sortOrder ?? body.sort_order ?? 0)
        })
        .select("*")
        .single()
    )) as DbOption;
    return { id: row.id };
  }
  if (optionMatch && request.method === "PATCH") {
    const body = await bodyOf(request);
    const payload: Record<string, string | number> = {};
    if (body.value !== undefined) payload.value = String(body.value);
    if (body.sortOrder !== undefined || body.sort_order !== undefined) {
      payload.sort_order = Number(body.sortOrder ?? body.sort_order);
    }
    await unwrap(supabase().from("settings_options").update(payload).eq("id", optionMatch[1]));
    return { ok: true };
  }
  if (optionMatch && request.method === "DELETE") {
    await unwrap(supabase().from("settings_options").update({ deleted_at: new Date().toISOString() }).eq("id", optionMatch[1]));
    return { ok: true };
  }
  return null;
}

async function handleDashboard(pathname: string, request: Request): Promise<HandlerResult> {
  if (pathname !== "/api/dashboard" || request.method !== "GET") return null;
  const orders = await fetchMappedOrders();
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const dueFollowups = orders
    .filter(
      (order) =>
        order.nextFollowUpAt &&
        new Date(order.nextFollowUpAt).getTime() <= Date.now() &&
        order.orderStatus !== "已完成"
    )
    .slice(0, 10);
  const data: DashboardData = {
    pendingPaymentCustomers: new Set(orders.filter((order) => order.orderStatus === "待支付").map((order) => order.customerId)).size,
    paidWaitingTrackingOrders: orders.filter(
      (order) => order.paymentStatus === "已支付" && !order.trackingNumber && order.orderStatus !== "已完成"
    ).length,
    trackingOrders: orders.filter((order) => order.orderStatus === "物流追踪中").length,
    logisticsExceptionOrders: orders.filter((order) => order.orderStatus === "物流异常" || order.logisticsStatus === "异常").length,
    signedNeedFollowupOrders: orders.filter((order) => order.orderStatus === "已签收待回访").length,
    followupsDueToday: orders.filter(
      (order) =>
        order.nextFollowUpAt &&
        new Date(order.nextFollowUpAt).getTime() <= todayEnd.getTime() &&
        order.orderStatus !== "已完成"
    ).length,
    dueFollowups
  };
  return data as unknown as Record<string, unknown>;
}

async function handleStatistics(pathname: string, query: Query, request: Request): Promise<HandlerResult> {
  if (pathname !== "/api/statistics" || request.method !== "GET") return null;
  const month = query.month || new Date().toISOString().slice(0, 7);
  const orders = await fetchMappedOrders();
  const paidOrdersByCustomer = new Map<string, Order[]>();
  orders
    .filter((order) => order.paymentStatus === "已支付")
    .forEach((order) => {
      paidOrdersByCustomer.set(order.customerId, [...(paidOrdersByCustomer.get(order.customerId) || []), order]);
    });
  const data: StatisticsData = {
    monthlyOrderCount: orders.filter((order) => order.createdAt.slice(0, 7) === month).length,
    monthlyRevenue: orders
      .filter((order) => order.paymentStatus === "已支付" && order.paymentDate?.slice(0, 7) === month)
      .reduce((sum, order) => sum + order.amount, 0),
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

async function handleExport(pathname: string, request: Request): Promise<HandlerResult> {
  if (pathname !== "/api/export" || request.method !== "GET") return null;
  const [customers, orders, communications, options] = await Promise.all([
    fetchCustomersRaw(),
    fetchOrdersRaw(),
    unwrap(supabase().from("communications").select("*").is("deleted_at", null).returns<DbCommunication[]>()),
    fetchOptionsRaw()
  ]);
  return { customers, orders, communications, options };
}

function toResponse(result: HandlerResult) {
  if (result instanceof Response) return result;
  if (result === null) fail("未支持的接口", 404);
  return Response.json(result);
}

export default async function handler(request: Request) {
  try {
    const { pathname, query } = parsePath(request);
    const authResult = await handleAuth(pathname, request);
    if (authResult !== null) return toResponse(authResult);

    requireSession(request);

    const result =
      (await handleDashboard(pathname, request)) ??
      (await handleCustomers(pathname, query, request)) ??
      (await handleOrders(pathname, query, request)) ??
      (await handleStatistics(pathname, query, request)) ??
      (await handleSettings(pathname, query, request)) ??
      (await handleExport(pathname, request));

    return toResponse(result);
  } catch (err) {
    const status = err instanceof Error && "status" in err ? (err as ApiError).status || 500 : 500;
    const message = err instanceof Error ? err.message : "服务器错误";
    return Response.json({ error: message }, { status });
  }
}
