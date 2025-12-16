import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, TrendingUp, AlertCircle, Users, Star, Crown, Award, ArrowRight, LayoutDashboard } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useDateFormat } from "@/hooks/use-date-format";

interface DashboardStats {
  todaySales: {
    revenue: number;
    transactions: number;
  };
  monthlySales: {
    revenue: number;
    transactions: number;
  };
  inventory: {
    totalProducts: number;
    totalVariants: number;
    totalColors: number;
    lowStock: number;
    totalStockValue: number;
  };
  unpaidBills: {
    count: number;
    totalAmount: number;
  };
  recentSales: Array<{
    id: string;
    customerName: string;
    totalAmount: string;
    paymentStatus: string;
    createdAt: string;
  }>;
  monthlyChart: Array<{
    date: string;
    revenue: number;
  }>;
  topCustomers: Array<{
    customerName: string;
    customerPhone: string;
    totalPurchases: number;
    transactionCount: number;
  }>;
}

export default function Dashboard() {
  const { formatDateShort } = useDateFormat();
  
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard-stats"],
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-4 md:p-6 space-y-5">
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <Skeleton className="h-6 w-40 mb-1" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
              <Skeleton className="h-4 w-20 mb-3" />
              <Skeleton className="h-7 w-28 mb-1" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const metricCards = [
    {
      title: "Today's Sales",
      value: `Rs. ${Math.round(stats?.todaySales.revenue || 0).toLocaleString()}`,
      subtitle: `${stats?.todaySales.transactions || 0} transactions`,
      icon: ShoppingCart,
      gradient: "from-emerald-500 to-teal-600",
      bgLight: "from-emerald-50 to-teal-50",
      textColor: "text-emerald-600",
    },
    {
      title: "Monthly Revenue",
      value: `Rs. ${Math.round(stats?.monthlySales.revenue || 0).toLocaleString()}`,
      subtitle: `${stats?.monthlySales.transactions || 0} transactions`,
      icon: TrendingUp,
      gradient: "from-blue-500 to-indigo-600",
      bgLight: "from-blue-50 to-indigo-50",
      textColor: "text-blue-600",
    },
    {
      title: "Inventory Value",
      value: `Rs. ${Math.round(stats?.inventory.totalStockValue || 0).toLocaleString()}`,
      subtitle: `${stats?.inventory.totalColors || 0} colors in stock`,
      icon: Package,
      gradient: "from-amber-500 to-orange-600",
      bgLight: "from-amber-50 to-orange-50",
      textColor: "text-amber-600",
    },
    {
      title: "Unpaid Bills",
      value: `Rs. ${Math.round(stats?.unpaidBills.totalAmount || 0).toLocaleString()}`,
      subtitle: `${stats?.unpaidBills.count || 0} pending`,
      icon: AlertCircle,
      gradient: "from-rose-500 to-red-600",
      bgLight: "from-rose-50 to-red-50",
      textColor: "text-rose-600",
    },
  ];

  const getRankBadge = (index: number) => {
    switch (index) {
      case 0:
        return { bg: "bg-gradient-to-r from-yellow-400 to-amber-500", icon: Crown, text: "text-white" };
      case 1:
        return { bg: "bg-gradient-to-r from-slate-400 to-slate-500", icon: Award, text: "text-white" };
      case 2:
        return { bg: "bg-gradient-to-r from-amber-600 to-amber-700", icon: Star, text: "text-white" };
      default:
        return { bg: "bg-slate-100", icon: Users, text: "text-slate-600" };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-4 md:p-6 space-y-5">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md">
            <LayoutDashboard className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800" data-testid="text-dashboard-title">
              Dashboard
            </h1>
            <p className="text-xs text-slate-500">Real-time store performance</p>
          </div>
        </div>
        
        {/* Quick Stats Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full border border-slate-100 shadow-sm text-xs">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
            <span className="text-slate-600"><strong className="text-slate-800">{stats?.todaySales.transactions || 0}</strong> Today</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full border border-slate-100 shadow-sm text-xs">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
            <span className="text-slate-600"><strong className="text-slate-800">{stats?.inventory.totalColors || 0}</strong> Colors</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full border border-slate-100 shadow-sm text-xs">
            <div className="w-1.5 h-1.5 bg-rose-500 rounded-full"></div>
            <span className="text-slate-600"><strong className="text-slate-800">{stats?.unpaidBills.count || 0}</strong> Pending</span>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((card) => (
          <div 
            key={card.title} 
            className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                {card.title}
              </p>
              <div className={`p-2 rounded-lg bg-gradient-to-br ${card.bgLight}`}>
                <card.icon className={`h-4 w-4 ${card.textColor}`} />
              </div>
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800 tabular-nums font-mono" data-testid={`text-${card.title.toLowerCase().replace(/\s+/g, '-')}-value`}>
                {card.value}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{card.subtitle}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Monthly Sales Trend */}
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50">
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Monthly Sales Trend</h3>
          </div>
          
          {stats?.monthlyChart && stats.monthlyChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={stats.monthlyChart}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`Rs. ${Math.round(value).toLocaleString()}`, "Revenue"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#salesGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center">
              <div className="text-center">
                <TrendingUp className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                <p className="text-xs text-slate-400">No sales data available</p>
              </div>
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-50 to-teal-50">
              <ShoppingCart className="h-4 w-4 text-emerald-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Recent Transactions</h3>
          </div>
          
          <div className="space-y-2">
            {stats?.recentSales && stats.recentSales.length > 0 ? (
              stats.recentSales.slice(0, 5).map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50/80 border border-slate-100"
                  data-testid={`sale-item-${sale.id}`}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{sale.customerName}</p>
                    <p className="text-[10px] text-slate-400">{formatDateShort(sale.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-mono font-semibold text-slate-800 tabular-nums">
                      Rs. {Math.round(parseFloat(sale.totalAmount)).toLocaleString()}
                    </p>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0.5 border-0 ${
                        sale.paymentStatus === "paid" 
                          ? "bg-emerald-50 text-emerald-600" 
                          : sale.paymentStatus === "partial"
                          ? "bg-amber-50 text-amber-600"
                          : "bg-rose-50 text-rose-600"
                      }`}
                    >
                      {sale.paymentStatus}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-[200px] flex items-center justify-center">
                <div className="text-center">
                  <ShoppingCart className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs text-slate-400">No recent transactions</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Customers Section */}
      <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50">
            <Crown className="h-4 w-4 text-purple-600" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Top 20 High Purchaser Customers</h3>
        </div>
        
        {stats?.topCustomers && stats.topCustomers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="text-left py-2.5 px-3">Rank</th>
                  <th className="text-left py-2.5 px-3">Customer</th>
                  <th className="text-left py-2.5 px-3">Phone</th>
                  <th className="text-right py-2.5 px-3">Purchases</th>
                  <th className="text-right py-2.5 px-3">Trans</th>
                </tr>
              </thead>
              <tbody>
                {stats.topCustomers.map((customer, index) => {
                  const totalPurchases = parseFloat(customer.totalPurchases.toString()) || 0;
                  const transactionCount = parseInt(customer.transactionCount.toString()) || 0;
                  const rankBadge = getRankBadge(index);
                  const IconComponent = rankBadge.icon;
                  
                  return (
                    <tr
                      key={`${customer.customerPhone}-${index}`}
                      className="border-b border-slate-50 last:border-0"
                    >
                      <td className="py-2.5 px-3">
                        <div className={`flex items-center justify-center w-6 h-6 rounded-full ${rankBadge.bg} ${rankBadge.text} text-[10px] font-semibold`}>
                          {index < 3 ? <IconComponent className="h-3 w-3" /> : index + 1}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-gradient-to-br from-slate-400 to-slate-600 rounded-full flex items-center justify-center">
                            <span className="text-[10px] font-semibold text-white">
                              {customer.customerName?.charAt(0)?.toUpperCase() || 'N'}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-slate-800">
                            {customer.customerName || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-500">{customer.customerPhone || 'N/A'}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="text-sm font-mono font-bold text-blue-600 tabular-nums">
                          Rs. {Math.round(totalPurchases).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200 text-slate-600">
                          {transactionCount}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-[150px] flex items-center justify-center">
            <div className="text-center">
              <Users className="h-10 w-10 mx-auto mb-2 text-slate-300" />
              <p className="text-xs text-slate-400">No customer data available</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
