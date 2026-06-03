import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Edit,
  Home,
  LogOut,
  PackageCheck,
  Plus,
  Save,
  Search,
  Settings,
  Trash2,
  Truck,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { api, exportSharedData } from "./api";
import type {
  Customer,
  CustomerDetail,
  DashboardData,
  DictionaryOption,
  Order,
  StatisticsData,
  User
} from "./types";
import { classNames, formatDate, formatDateTime, formatMoney, toDateInput, toDateTimeInput } from "./utils";

const ORDER_STATUSES = [
  "待沟通",
  "已报价",
  "待支付",
  "已支付待处理",
  "仓库处理中",
  "待发物流单号",
  "物流追踪中",
  "物流异常",
  "已签收待回访",
  "已完成"
];

const PAYMENT_STATUSES = ["未支付", "已支付", "部分支付", "已退款"];
const LOGISTICS_STATUSES = ["待处理", "已揽收", "运输中", "清关中", "派送中", "已签收", "异常"];

const CATEGORY_LABELS = {
  countries: "国家",
  sources: "客户来源",
  tags: "客户标签",
  logistics_companies: "物流公司"
} as const;

type PageKey =
  | "dashboard"
  | "customers"
  | "orders"
  | "pending-payment"
  | "paid-no-tracking"
  | "tracking"
  | "exception"
  | "signed-followup"
  | "statistics"
  | "settings";

type OptionsByCategory = Record<keyof typeof CATEGORY_LABELS, string[]>;

const emptyOptions: OptionsByCategory = {
  countries: [],
  sources: [],
  tags: [],
  logistics_companies: []
};

const navItems: Array<{ key: PageKey; label: string; icon: typeof Home }> = [
  { key: "dashboard", label: "首页仪表盘", icon: Home },
  { key: "customers", label: "客户管理", icon: Users },
  { key: "orders", label: "订单管理", icon: ClipboardList },
  { key: "pending-payment", label: "待支付客户", icon: AlertTriangle },
  { key: "paid-no-tracking", label: "已支付待发单号", icon: PackageCheck },
  { key: "tracking", label: "物流追踪", icon: Truck },
  { key: "exception", label: "物流异常", icon: AlertTriangle },
  { key: "signed-followup", label: "已签收待回访", icon: CheckCircle2 },
  { key: "statistics", label: "数据统计", icon: BarChart3 },
  { key: "settings", label: "设置", icon: Settings }
];

const pageTitles = Object.fromEntries(navItems.map((item) => [item.key, item.label])) as Record<PageKey, string>;

function isOrderPage(page: PageKey) {
  return ["orders", "pending-payment", "paid-no-tracking", "tracking", "exception", "signed-followup"].includes(page);
}

function statusClass(status: string) {
  if (status.includes("异常")) return "badge danger";
  if (status.includes("待支付")) return "badge warning";
  if (status.includes("已完成")) return "badge success";
  if (status.includes("已签收")) return "badge teal";
  if (status.includes("物流")) return "badge blue";
  return "badge";
}

function paymentClass(status: string) {
  if (status === "已支付") return "badge success";
  if (status === "已退款") return "badge muted";
  if (status === "部分支付") return "badge blue";
  return "badge warning";
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activePage, setActivePage] = useState<PageKey>("dashboard");
  const [error, setError] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [statistics, setStatistics] = useState<StatisticsData | null>(null);
  const [optionRows, setOptionRows] = useState<DictionaryOption[]>([]);
  const [options, setOptions] = useState<OptionsByCategory>(emptyOptions);
  const [customerModal, setCustomerModal] = useState<Customer | "new" | null>(null);
  const [orderModal, setOrderModal] = useState<Order | "new" | null>(null);
  const [orderFilters, setOrderFilters] = useState({
    status: "",
    country: "",
    tag: "",
    logisticsStatus: "",
    followup: "",
    followupFrom: "",
    followupTo: ""
  });
  const [statMonth, setStatMonth] = useState(new Date().toISOString().slice(0, 7));

  async function run(action: () => Promise<void>) {
    try {
      setError("");
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    }
  }

  async function refreshOptions() {
    const data = await api<{ options: DictionaryOption[] }>("/api/settings/options");
    const grouped: OptionsByCategory = {
      countries: [],
      sources: [],
      tags: [],
      logistics_companies: []
    };
    data.options.forEach((option) => {
      grouped[option.category].push(option.value);
    });
    setOptionRows(data.options);
    setOptions(grouped);
  }

  async function refreshCustomers() {
    const data = await api<{ customers: Customer[] }>("/api/customers");
    setCustomers(data.customers);
  }

  async function refreshDashboard() {
    const data = await api<DashboardData>("/api/dashboard");
    setDashboard(data);
  }

  function orderQuery() {
    const params = new URLSearchParams();
    if (activePage === "pending-payment") params.set("status", "待支付");
    if (activePage === "paid-no-tracking") params.set("trackingMissing", "1");
    if (activePage === "tracking") params.set("status", "物流追踪中");
    if (activePage === "exception") params.set("exception", "1");
    if (activePage === "signed-followup") params.set("status", "已签收待回访");

    if (activePage === "orders" && orderFilters.status) params.set("status", orderFilters.status);
    if (orderFilters.country) params.set("country", orderFilters.country);
    if (orderFilters.tag) params.set("tag", orderFilters.tag);
    if (orderFilters.logisticsStatus) params.set("logisticsStatus", orderFilters.logisticsStatus);
    if (orderFilters.followup) params.set("followup", orderFilters.followup);
    if (orderFilters.followupFrom) params.set("followupFrom", `${orderFilters.followupFrom}T00:00`);
    if (orderFilters.followupTo) params.set("followupTo", `${orderFilters.followupTo}T23:59`);
    return params.toString();
  }

  async function refreshOrders() {
    const query = orderQuery();
    const data = await api<{ orders: Order[] }>(`/api/orders${query ? `?${query}` : ""}`);
    setOrders(data.orders);
  }

  async function refreshStatistics() {
    const data = await api<StatisticsData>(`/api/statistics?month=${statMonth}`);
    setStatistics(data);
  }

  async function refreshAll() {
    await Promise.all([refreshOptions(), refreshCustomers(), refreshDashboard()]);
  }

  useEffect(() => {
    async function checkAuth() {
      try {
        const data = await api<{ user: User }>("/api/auth/me");
        setUser(data.user);
        await refreshAll();
      } catch {
        setUser(null);
      } finally {
        setAuthChecked(true);
      }
    }
    void checkAuth();
  }, []);

  useEffect(() => {
    if (!user || !isOrderPage(activePage)) return;
    void run(refreshOrders);
  }, [activePage, orderFilters, user]);

  useEffect(() => {
    if (!user || activePage !== "dashboard") return;
    void run(refreshDashboard);
  }, [activePage, user]);

  useEffect(() => {
    if (!user || activePage !== "statistics") return;
    void run(refreshStatistics);
  }, [activePage, statMonth, user]);

  async function logout() {
    await run(async () => {
      await api("/api/auth/logout", { method: "POST", body: "{}" });
      setUser(null);
    });
  }

  async function afterMutation() {
    await Promise.all([refreshCustomers(), refreshDashboard()]);
    if (isOrderPage(activePage)) await refreshOrders();
    if (activePage === "statistics") await refreshStatistics();
  }

  if (!authChecked) {
    return <div className="boot">加载中...</div>;
  }

  if (!user) {
    return (
      <LoginScreen
        error={error}
        onLogin={(nextUser) =>
          run(async () => {
            setUser(nextUser);
            await refreshAll();
          })
        }
      />
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">回</div>
          <div>
            <strong>客户回访管理</strong>
            <span>销售跟进系统</span>
          </div>
        </div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                className={classNames("nav-item", activePage === item.key && "active")}
                onClick={() => setActivePage(item.key)}
                title={item.label}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{pageTitles[activePage]}</h1>
            <span>{new Date().toLocaleDateString("zh-CN")}</span>
          </div>
          <div className="userbar">
            <span>{user.displayName}</span>
            <span className="role">团队共享</span>
            <button className="icon-button" onClick={logout} title="退出登录">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {error && <div className="notice">{error}</div>}

        {activePage === "dashboard" && (
          <DashboardPage dashboard={dashboard} onOpenPage={setActivePage} />
        )}

        {activePage === "customers" && (
          <CustomersPage
            customers={customers}
            options={options}
            onAdd={() => setCustomerModal("new")}
            onEdit={setCustomerModal}
            onRefresh={afterMutation}
          />
        )}

        {isOrderPage(activePage) && (
          <OrdersPage
            page={activePage}
            orders={orders}
            customers={customers}
            options={options}
            filters={orderFilters}
            onFiltersChange={setOrderFilters}
            onAdd={() => setOrderModal("new")}
            onEdit={setOrderModal}
            onRefresh={afterMutation}
          />
        )}

        {activePage === "statistics" && (
          <StatisticsPage statistics={statistics} month={statMonth} onMonthChange={setStatMonth} />
        )}

        {activePage === "settings" && (
          <SettingsPage
            optionRows={optionRows}
            onRefreshOptions={() => run(refreshOptions)}
            onRefreshAll={() => run(refreshAll)}
          />
        )}
      </main>

      {customerModal && (
        <CustomerModal
          customer={customerModal === "new" ? null : customerModal}
          options={options}
          onClose={() => setCustomerModal(null)}
          onSaved={() =>
            run(async () => {
              setCustomerModal(null);
              await afterMutation();
            })
          }
        />
      )}

      {orderModal && (
        <OrderModal
          order={orderModal === "new" ? null : orderModal}
          customers={customers}
          options={options}
          onClose={() => setOrderModal(null)}
          onSaved={() =>
            run(async () => {
              setOrderModal(null);
              await afterMutation();
            })
          }
        />
      )}
    </div>
  );
}

function LoginScreen({
  error,
  onLogin
}: {
  error: string;
  onLogin: (user: User) => Promise<void> | void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setLocalError("");
    try {
      const data = await api<{ user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ password })
      });
      await onLogin(data.user);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-panel" onSubmit={submit}>
        <div className="login-title">
          <div className="brand-mark">回</div>
          <h1>客户回访管理</h1>
        </div>
        {(localError || error) && <div className="notice">{localError || error}</div>}
        <label>
          团队访问密码
          <input
            value={password}
            type="password"
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            autoFocus
          />
        </label>
        <button className="primary-button" type="submit" disabled={busy}>
          <Save size={17} />
          登录
        </button>
      </form>
    </div>
  );
}

function DashboardPage({
  dashboard,
  onOpenPage
}: {
  dashboard: DashboardData | null;
  onOpenPage: (page: PageKey) => void;
}) {
  const cards = [
    { label: "待支付客户", value: dashboard?.pendingPaymentCustomers ?? 0, page: "pending-payment" as PageKey },
    { label: "已支付待发单号", value: dashboard?.paidWaitingTrackingOrders ?? 0, page: "paid-no-tracking" as PageKey },
    { label: "物流追踪中", value: dashboard?.trackingOrders ?? 0, page: "tracking" as PageKey },
    { label: "物流异常", value: dashboard?.logisticsExceptionOrders ?? 0, page: "exception" as PageKey },
    { label: "已签收待回访", value: dashboard?.signedNeedFollowupOrders ?? 0, page: "signed-followup" as PageKey },
    { label: "今日需要回访", value: dashboard?.followupsDueToday ?? 0, page: "orders" as PageKey }
  ];

  return (
    <section className="content-stack">
      <div className="metric-grid">
        {cards.map((card) => (
          <button className="metric-card" key={card.label} onClick={() => onOpenPage(card.page)}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </button>
        ))}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>到期回访</h2>
        </div>
        <OrderTable orders={dashboard?.dueFollowups ?? []} compact />
      </section>
    </section>
  );
}

function CustomersPage({
  customers,
  options,
  onAdd,
  onEdit,
  onRefresh
}: {
  customers: Customer[];
  options: OptionsByCategory;
  onAdd: () => void;
  onEdit: (customer: Customer) => void;
  onRefresh: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState("");

  const visibleCustomers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.contact, customer.country, customer.source, customer.tags.join(","), customer.notes]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [customers, search]);

  async function loadDetail(id: string) {
    setSelectedId(id);
    setError("");
    try {
      const data = await api<CustomerDetail>(`/api/customers/${id}`);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "客户详情加载失败");
    }
  }

  async function removeCustomer(customer: Customer) {
    if (!window.confirm(`删除客户「${customer.name}」？`)) return;
    await api(`/api/customers/${customer.id}`, { method: "DELETE" });
    setDetail(null);
    setSelectedId(null);
    await onRefresh();
  }

  return (
    <section className="content-stack">
      <div className="toolbar">
        <label className="search-box">
          <Search size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索客户" />
        </label>
        <button className="primary-button" onClick={onAdd}>
          <Plus size={17} />
          新增客户
        </button>
      </div>

      {error && <div className="notice">{error}</div>}

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>客户姓名</th>
                <th>联系方式</th>
                <th>国家</th>
                <th>来源</th>
                <th>标签</th>
                <th>订单数</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleCustomers.map((customer) => (
                <tr key={customer.id} className={selectedId === customer.id ? "selected-row" : ""}>
                  <td>
                    <button className="link-button" onClick={() => loadDetail(customer.id)}>
                      {customer.name}
                    </button>
                  </td>
                  <td>{customer.contact || "-"}</td>
                  <td>{customer.country || "-"}</td>
                  <td>{customer.source || "-"}</td>
                  <td>
                    <TagList tags={customer.tags} />
                  </td>
                  <td>{customer.ordersCount}</td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-button" onClick={() => onEdit(customer)} title="编辑客户">
                        <Edit size={16} />
                      </button>
                      <button className="icon-button danger" onClick={() => removeCustomer(customer)} title="删除客户">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {detail && (
        <CustomerDetailPanel
          detail={detail}
          options={options}
          onReload={() => loadDetail(detail.customer.id)}
          onRefresh={onRefresh}
        />
      )}
    </section>
  );
}

function CustomerDetailPanel({
  detail,
  onReload,
  onRefresh
}: {
  detail: CustomerDetail;
  options: OptionsByCategory;
  onReload: () => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{detail.customer.name}</h2>
          <span>{detail.customer.contact || "-"}</span>
        </div>
      </div>

      <div className="detail-grid">
        <div>
          <h3>客户订单</h3>
          <OrderTable orders={detail.orders} compact />
        </div>
        <div>
          <h3>沟通记录</h3>
          <CommunicationForm
            customerId={detail.customer.id}
            orders={detail.orders}
            onSaved={async () => {
              await onReload();
              await onRefresh();
            }}
          />
          <div className="timeline">
            {detail.communications.map((item) => (
              <div className="timeline-item" key={item.id}>
                <strong>{formatDateTime(item.communicatedAt)}</strong>
                <p>{item.content}</p>
                <span>下次跟进：{formatDateTime(item.nextFollowUpAt)}</span>
                {item.followerNote && <em>{item.followerNote}</em>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CommunicationForm({
  customerId,
  orders,
  onSaved
}: {
  customerId: string;
  orders: Order[];
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    orderId: "",
    communicatedAt: toDateTimeInput(new Date().toISOString()),
    content: "",
    nextFollowUpAt: "",
    followerNote: ""
  });
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(`/api/customers/${customerId}/communications`, {
        method: "POST",
        body: JSON.stringify({
          ...form,
          orderId: form.orderId || null
        })
      });
      setForm({
        orderId: "",
        communicatedAt: toDateTimeInput(new Date().toISOString()),
        content: "",
        nextFollowUpAt: "",
        followerNote: ""
      });
      await onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <select value={form.orderId} onChange={(event) => setForm({ ...form, orderId: event.target.value })}>
        <option value="">全部订单</option>
        {orders.map((order) => (
          <option value={order.id} key={order.id}>
            {order.product || `订单 #${order.id}`}
          </option>
        ))}
      </select>
      <input
        type="datetime-local"
        value={form.communicatedAt}
        onChange={(event) => setForm({ ...form, communicatedAt: event.target.value })}
      />
      <textarea
        value={form.content}
        onChange={(event) => setForm({ ...form, content: event.target.value })}
        placeholder="沟通内容"
        required
      />
      <input
        type="datetime-local"
        value={form.nextFollowUpAt}
        onChange={(event) => setForm({ ...form, nextFollowUpAt: event.target.value })}
      />
      <input
        value={form.followerNote}
        onChange={(event) => setForm({ ...form, followerNote: event.target.value })}
        placeholder="跟进人备注"
      />
      <button className="primary-button" disabled={busy}>
        <Save size={16} />
        保存记录
      </button>
    </form>
  );
}

function OrdersPage({
  page,
  orders,
  customers,
  options,
  filters,
  onFiltersChange,
  onAdd,
  onEdit,
  onRefresh
}: {
  page: PageKey;
  orders: Order[];
  customers: Customer[];
  options: OptionsByCategory;
  filters: {
    status: string;
    country: string;
    tag: string;
    logisticsStatus: string;
    followup: string;
    followupFrom: string;
    followupTo: string;
  };
  onFiltersChange: (filters: {
    status: string;
    country: string;
    tag: string;
    logisticsStatus: string;
    followup: string;
    followupFrom: string;
    followupTo: string;
  }) => void;
  onAdd: () => void;
  onEdit: (order: Order) => void;
  onRefresh: () => Promise<void>;
}) {
  async function removeOrder(order: Order) {
    if (!window.confirm(`删除订单「${order.product || order.id}」？`)) return;
    await api(`/api/orders/${order.id}`, { method: "DELETE" });
    await onRefresh();
  }

  return (
    <section className="content-stack">
      <div className="toolbar">
        <div className="filter-grid">
          {page === "orders" && (
            <select value={filters.status} onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })}>
              <option value="">全部状态</option>
              {ORDER_STATUSES.map((status) => (
                <option value={status} key={status}>
                  {status}
                </option>
              ))}
            </select>
          )}
          <select value={filters.country} onChange={(event) => onFiltersChange({ ...filters, country: event.target.value })}>
            <option value="">全部国家</option>
            {options.countries.map((country) => (
              <option value={country} key={country}>
                {country}
              </option>
            ))}
          </select>
          <select value={filters.tag} onChange={(event) => onFiltersChange({ ...filters, tag: event.target.value })}>
            <option value="">全部标签</option>
            {options.tags.map((tag) => (
              <option value={tag} key={tag}>
                {tag}
              </option>
            ))}
          </select>
          <select
            value={filters.followup}
            onChange={(event) => onFiltersChange({ ...filters, followup: event.target.value })}
          >
            <option value="">全部回访</option>
            <option value="due">已到期</option>
            <option value="today">今天</option>
            <option value="none">未设置</option>
          </select>
          <input
            type="date"
            value={filters.followupFrom}
            onChange={(event) => onFiltersChange({ ...filters, followupFrom: event.target.value })}
            aria-label="回访开始日期"
            title="回访开始日期"
          />
          <input
            type="date"
            value={filters.followupTo}
            onChange={(event) => onFiltersChange({ ...filters, followupTo: event.target.value })}
            aria-label="回访结束日期"
            title="回访结束日期"
          />
          <select
            value={filters.logisticsStatus}
            onChange={(event) => onFiltersChange({ ...filters, logisticsStatus: event.target.value })}
          >
            <option value="">全部物流状态</option>
            {LOGISTICS_STATUSES.map((status) => (
              <option value={status} key={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <button className="primary-button" onClick={onAdd} disabled={customers.length === 0}>
          <Plus size={17} />
          新增订单
        </button>
      </div>
      <section className="panel">
        <OrderTable orders={orders} onEdit={onEdit} onDelete={removeOrder} />
      </section>
    </section>
  );
}

function OrderTable({
  orders,
  onEdit,
  onDelete,
  compact = false
}: {
  orders: Order[];
  onEdit?: (order: Order) => void;
  onDelete?: (order: Order) => void;
  compact?: boolean;
}) {
  if (orders.length === 0) {
    return <div className="empty">暂无数据</div>;
  }

  return (
    <div className="table-wrap">
      <table className={compact ? "compact-table" : ""}>
        <thead>
          <tr>
            <th>提醒</th>
            <th>客户</th>
            <th>产品</th>
            <th>金额</th>
            <th>订单状态</th>
            <th>付款</th>
            <th>物流</th>
            <th>最后联系</th>
            <th>下次回访</th>
            {(onEdit || onDelete) && <th>操作</th>}
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr
              key={order.id}
              className={classNames(order.alertLevel === "red" && "alert-red", order.alertLevel === "yellow" && "alert-yellow")}
            >
              <td>
                {order.alertLevel ? (
                  <span className={order.alertLevel === "red" ? "badge danger" : "badge warning"}>
                    {order.alertReasons[0]}
                  </span>
                ) : (
                  <span className="badge muted">正常</span>
                )}
              </td>
              <td>
                <strong>{order.customerName}</strong>
                <small>{order.customerContact || "-"}</small>
              </td>
              <td>{order.product || "-"}</td>
              <td>{formatMoney(order.amount)}</td>
              <td>
                <span className={statusClass(order.orderStatus)}>{order.orderStatus}</span>
              </td>
              <td>
                <span className={paymentClass(order.paymentStatus)}>{order.paymentStatus}</span>
                <small>{formatDate(order.paymentDate)}</small>
              </td>
              <td>
                <span>{order.logisticsCompany || "-"}</span>
                <small>{order.trackingNumber || order.logisticsStatus || "-"}</small>
              </td>
              <td>{formatDateTime(order.lastContactAt)}</td>
              <td>{formatDateTime(order.nextFollowUpAt)}</td>
              {(onEdit || onDelete) && (
                <td>
                  <div className="row-actions">
                    {onEdit && (
                      <button className="icon-button" onClick={() => onEdit(order)} title="编辑订单">
                        <Edit size={16} />
                      </button>
                    )}
                    {onDelete && (
                      <button className="icon-button danger" onClick={() => onDelete(order)} title="删除订单">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatisticsPage({
  statistics,
  month,
  onMonthChange
}: {
  statistics: StatisticsData | null;
  month: string;
  onMonthChange: (month: string) => void;
}) {
  const metrics = [
    { label: "本月订单数量", value: statistics?.monthlyOrderCount ?? 0 },
    { label: "本月成交金额", value: formatMoney(statistics?.monthlyRevenue ?? 0) },
    { label: "待支付金额", value: formatMoney(statistics?.pendingPaymentAmount ?? 0) },
    { label: "物流异常订单数", value: statistics?.logisticsExceptionOrderCount ?? 0 },
    { label: "已签收待回访数量", value: statistics?.signedNeedFollowupCount ?? 0 },
    { label: "复购客户数", value: statistics?.repeatCustomerCount ?? 0 }
  ];

  return (
    <section className="content-stack">
      <div className="toolbar">
        <input type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} />
      </div>
      <div className="metric-grid">
        {metrics.map((metric) => (
          <div className="metric-card static" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function SettingsPage({
  optionRows,
  onRefreshOptions,
  onRefreshAll
}: {
  optionRows: DictionaryOption[];
  onRefreshOptions: () => Promise<void> | void;
  onRefreshAll: () => Promise<void> | void;
}) {
  const [newOption, setNewOption] = useState({ category: "tags" as DictionaryOption["category"], value: "" });

  async function addOption(event: FormEvent) {
    event.preventDefault();
    await api("/api/settings/options", {
      method: "POST",
      body: JSON.stringify(newOption)
    });
    setNewOption({ ...newOption, value: "" });
    await onRefreshOptions();
  }

  async function deleteOption(id: string) {
    await api(`/api/settings/options/${id}`, { method: "DELETE" });
    await onRefreshOptions();
  }

  const groupedOptions = optionRows.reduce<Record<string, DictionaryOption[]>>((acc, option) => {
    acc[option.category] = acc[option.category] || [];
    acc[option.category].push(option);
    return acc;
  }, {});

  return (
    <section className="content-stack">
      <section className="panel">
        <div className="panel-heading">
          <h2>字典管理</h2>
          <form className="settings-form" onSubmit={addOption}>
            <select
              value={newOption.category}
              onChange={(event) =>
                setNewOption({ ...newOption, category: event.target.value as DictionaryOption["category"] })
              }
            >
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
            <input
              value={newOption.value}
              onChange={(event) => setNewOption({ ...newOption, value: event.target.value })}
              placeholder="新增选项"
              required
            />
            <button className="primary-button">
              <Plus size={16} />
              添加
            </button>
          </form>
        </div>
        <div className="settings-grid">
          {Object.entries(CATEGORY_LABELS).map(([category, label]) => (
            <div className="dictionary-column" key={category}>
              <h3>{label}</h3>
              {(groupedOptions[category] || []).map((option) => (
                <div className="dictionary-item" key={option.id}>
                  <span>{option.value}</span>
                  <button className="icon-button danger" onClick={() => deleteOption(option.id)} title="删除选项">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>数据备份</h2>
          <span>共享数据保存在 Supabase；这里可以导出一份 JSON 备份到本机。</span>
        </div>
        <div className="row-actions">
          <button className="secondary-button" onClick={() => onRefreshAll()}>
            刷新数据
          </button>
          <button className="secondary-button" onClick={() => exportSharedData()}>
            导出备份
          </button>
        </div>
      </section>
    </section>
  );
}

function CustomerModal({
  customer,
  options,
  onClose,
  onSaved
}: {
  customer: Customer | null;
  options: OptionsByCategory;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [form, setForm] = useState({
    name: customer?.name ?? "",
    contact: customer?.contact ?? "",
    country: customer?.country ?? "",
    source: customer?.source ?? "",
    tags: customer?.tags.join(", ") ?? "",
    notes: customer?.notes ?? ""
  });
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(customer ? `/api/customers/${customer.id}` : "/api/customers", {
        method: customer ? "PATCH" : "POST",
        body: JSON.stringify({
          ...form,
          tags: form.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        })
      });
      await onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={customer ? "编辑客户" : "新增客户"} onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <label>
          客户姓名
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label>
          联系方式
          <input value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} />
        </label>
        <label>
          国家
          <input
            list="country-options"
            value={form.country}
            onChange={(event) => setForm({ ...form, country: event.target.value })}
          />
          <datalist id="country-options">
            {options.countries.map((item) => (
              <option value={item} key={item} />
            ))}
          </datalist>
        </label>
        <label>
          客户来源
          <input
            list="source-options"
            value={form.source}
            onChange={(event) => setForm({ ...form, source: event.target.value })}
          />
          <datalist id="source-options">
            {options.sources.map((item) => (
              <option value={item} key={item} />
            ))}
          </datalist>
        </label>
        <label className="wide-field">
          客户标签
          <input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} />
        </label>
        <label className="wide-field">
          备注
          <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            取消
          </button>
          <button className="primary-button" disabled={busy}>
            <Save size={16} />
            保存
          </button>
        </div>
      </form>
    </Modal>
  );
}

function OrderModal({
  order,
  customers,
  options,
  onClose,
  onSaved
}: {
  order: Order | null;
  customers: Customer[];
  options: OptionsByCategory;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [form, setForm] = useState({
    customerId: String(order?.customerId ?? customers[0]?.id ?? ""),
    product: order?.product ?? "",
    amount: String(order?.amount ?? 0),
    paymentStatus: order?.paymentStatus ?? "未支付",
    paymentDate: toDateInput(order?.paymentDate),
    orderStatus: order?.orderStatus ?? "待沟通",
    trackingNumber: order?.trackingNumber ?? "",
    logisticsCompany: order?.logisticsCompany ?? "",
    logisticsStatus: order?.logisticsStatus ?? "",
    lastContactAt: toDateTimeInput(order?.lastContactAt),
    nextFollowUpAt: toDateTimeInput(order?.nextFollowUpAt),
    notes: order?.notes ?? ""
  });
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(order ? `/api/orders/${order.id}` : "/api/orders", {
        method: order ? "PATCH" : "POST",
        body: JSON.stringify({
          ...form,
          customerId: form.customerId,
          amount: Number(form.amount || 0)
        })
      });
      await onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={order ? "编辑订单" : "新增订单"} onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <label>
          客户
          <select
            value={form.customerId}
            onChange={(event) => setForm({ ...form, customerId: event.target.value })}
            required
          >
            {customers.map((customer) => (
              <option value={customer.id} key={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          购买产品
          <input value={form.product} onChange={(event) => setForm({ ...form, product: event.target.value })} />
        </label>
        <label>
          订单金额
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
          />
        </label>
        <label>
          付款状态
          <select
            value={form.paymentStatus}
            onChange={(event) => setForm({ ...form, paymentStatus: event.target.value })}
          >
            {PAYMENT_STATUSES.map((status) => (
              <option value={status} key={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          付款日期
          <input
            type="date"
            value={form.paymentDate}
            onChange={(event) => setForm({ ...form, paymentDate: event.target.value })}
          />
        </label>
        <label>
          订单状态
          <select value={form.orderStatus} onChange={(event) => setForm({ ...form, orderStatus: event.target.value })}>
            {ORDER_STATUSES.map((status) => (
              <option value={status} key={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          物流单号
          <input
            value={form.trackingNumber}
            onChange={(event) => setForm({ ...form, trackingNumber: event.target.value })}
          />
        </label>
        <label>
          物流公司
          <input
            list="logistics-company-options"
            value={form.logisticsCompany}
            onChange={(event) => setForm({ ...form, logisticsCompany: event.target.value })}
          />
          <datalist id="logistics-company-options">
            {options.logistics_companies.map((item) => (
              <option value={item} key={item} />
            ))}
          </datalist>
        </label>
        <label>
          物流状态
          <select
            value={form.logisticsStatus}
            onChange={(event) => setForm({ ...form, logisticsStatus: event.target.value })}
          >
            <option value="">未设置</option>
            {LOGISTICS_STATUSES.map((status) => (
              <option value={status} key={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          最后联系时间
          <input
            type="datetime-local"
            value={form.lastContactAt}
            onChange={(event) => setForm({ ...form, lastContactAt: event.target.value })}
          />
        </label>
        <label>
          下次回访时间
          <input
            type="datetime-local"
            value={form.nextFollowUpAt}
            onChange={(event) => setForm({ ...form, nextFollowUpAt: event.target.value })}
          />
        </label>
        <label className="wide-field">
          订单备注
          <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            取消
          </button>
          <button className="primary-button" disabled={busy || customers.length === 0}>
            <Save size={16} />
            保存
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return <span>-</span>;
  return (
    <div className="tag-list">
      {tags.map((tag) => (
        <span className="tag" key={tag}>
          {tag}
        </span>
      ))}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-panel" role="dialog" aria-modal="true">
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} title="关闭">
            x
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
