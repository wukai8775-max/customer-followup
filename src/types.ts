export interface User {
  id: string;
  username: string;
  displayName: string;
}

export interface DictionaryOption {
  id: string;
  category: "countries" | "sources" | "tags" | "logistics_companies";
  value: string;
  sortOrder: number;
}

export interface Customer {
  id: string;
  name: string;
  contact: string;
  country: string;
  source: string;
  tags: string[];
  notes: string;
  ordersCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerContact: string;
  country: string;
  source: string;
  customerTags: string[];
  product: string;
  amount: number;
  paymentStatus: string;
  paymentDate: string | null;
  orderStatus: string;
  trackingNumber: string | null;
  logisticsCompany: string | null;
  logisticsStatus: string | null;
  logisticsUpdatedAt: string | null;
  lastContactAt: string | null;
  nextFollowUpAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  alertLevel: "red" | "yellow" | null;
  alertReasons: string[];
}

export interface Communication {
  id: string;
  customerId: string;
  orderId: string | null;
  communicatedAt: string;
  content: string;
  nextFollowUpAt: string | null;
  followerNote: string;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDetail {
  customer: Customer;
  orders: Order[];
  communications: Communication[];
}

export interface DashboardData {
  pendingPaymentCustomers: number;
  paidWaitingTrackingOrders: number;
  trackingOrders: number;
  logisticsExceptionOrders: number;
  signedNeedFollowupOrders: number;
  followupsDueToday: number;
  dueFollowups: Order[];
}

export interface StatisticsData {
  monthlyOrderCount: number;
  monthlyRevenue: number;
  pendingPaymentAmount: number;
  logisticsExceptionOrderCount: number;
  signedNeedFollowupCount: number;
  repeatCustomerCount: number;
}
