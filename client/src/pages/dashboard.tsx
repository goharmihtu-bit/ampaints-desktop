import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, TrendingUp, AlertCircle, Users, Star, Crown, Award, ArrowRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
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
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    refetchOnWindowFocus: true, // Refresh when tab becomes active
  });

  // Add CSS for glass effect
  const glassStyles = `
    .glass-card {
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }
    .glass-destructive {
      background: rgba(239, 68, 68, 0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(239, 68, 68, 0.2);
    }
    .glass-warning {
      background: rgba(245, 158, 11, 0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(245, 158, 11, 0.2);
    }
    .glass-success {
      background: rgba(34, 197, 94, 0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(34, 197, 94, 0.2);
    }
    .glass-outline {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.3);
    }
    .hover-elevate {
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .hover-elevate:hover {
      transform: translateY(-4px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
    }
    .gradient-bg {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .gradient-text {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
  `;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6 space-y-6">
        <style>{glassStyles}</style>
        <div className="glass-card rounded-2xl p-6 border border-white/20">
          <Skeleton className="h-8 w-48 mb-2 rounded-lg" />
          <Skeleton className="h-4 w-64 rounded-lg" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card rounded-2xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-4 w-24 rounded-lg" />
                <Skeleton className="h-10 w-10 rounded-xl" />
              </div>
              <Skeleton className="h-8 w-32 mb-2 rounded-lg" />
              <Skeleton className="h-3 w-40 rounded-lg" />
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
      trend: "today",
      gradient: "from-emerald-500 to-cyan-500",
    },
    {
      title: "Monthly Revenue",
      value: `Rs. ${Math.round(stats?.monthlySales.revenue || 0).toLocaleString()}`,
      subtitle: `${stats?.monthlySales.transactions || 0} transactions`,
      icon: TrendingUp,
      trend: "monthly",
      gradient: "from-blue-500 to-purple-500",
    },
    {
      title: "Inventory Value",
      value: `Rs. ${Math.round(stats?.inventory.totalStockValue || 0).toLocaleString()}`,
      subtitle: `${stats?.inventory.totalColors || 0} colors in stock`,
      icon: Package,
      trend: "inventory",
      gradient: "from-amber-500 to-orange-500",
    },
    {
      title: "Unpaid Bills",
      value: `Rs. ${Math.round(stats?.unpaidBills.totalAmount || 0).toLocaleString()}`,
      subtitle: `${stats?.unpaidBills.count || 0} pending`,
      icon: AlertCircle,
      trend: "unpaid",
      gradient: "from-red-500 to-pink-500",
    },
  ];

  const getRankBadge = (index: number) => {
    switch (index) {
      case 0:
        return {
          bg: "bg-gradient-to-r from-yellow-400 to-yellow-600",
          icon: Crown,
          text: "text-white"
        };
      case 1:
        return {
          bg: "bg-gradient-to-r from-gray-400 to-gray-600",
          icon: Award,
          text: "text-white"
        };
      case 2:
        return {
          bg: "bg-gradient-to-r from-amber-600 to-amber-800",
          icon: Star,
          text: "text-white"
        };
      default:
        return {
          bg: "glass-card border-white/20",
          icon: Users,
          text: "text-slate-700"
        };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6 space-y-6">
      <style>{glassStyles}</style>
      
      {/* Header Section */}
      <div className="glass-card rounded-2xl p-6 border border-white/20 shadow-xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="gradient-bg p-2 rounded-xl">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent" data-testid="text-dashboard-title">
              Dashboard Overview
            </h1>
            <p className="text-sm text-slate-600 mt-1">Real-time insights into your paint store performance</p>
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="flex items-center gap-6 mt-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
            <span className="text-slate-700">
              <strong>{stats?.todaySales.transactions || 0}</strong> Today's Transactions
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-slate-700">
              <strong>{stats?.inventory.totalColors || 0}</strong> Colors Available
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-slate-700">
              <strong>{stats?.unpaidBills.count || 0}</strong> Pending Bills
            </span>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((card) => (
          <div 
            key={card.title} 
            className="glass-card rounded-2xl p-6 border border-white/20 hover-elevate group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700 group-hover:text-purple-600 transition-colors">
                {card.title}
              </h3>
              <div className={`p-3 rounded-xl bg-gradient-to-r ${card.gradient}`}>
                <card.icon className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold font-mono text-slate-800" data-testid={`text-${card.title.toLowerCase().replace(/\s+/g, '-')}-value`}>
                {card.value}
              </div>
              <p className="text-sm text-slate-600">{card.subtitle}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Sales Trend */}
        <div className="glass-card rounded-2xl p-6 border border-white/20">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 rounded-lg bg-blue-100">
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Monthly Sales Trend</h3>
          </div>
          
          {stats?.monthlyChart && stats.monthlyChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.monthlyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.3)" />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(value) => `Rs. ${Math.round(value)}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                    backdropFilter: "blur(10px)",
                    border: "1px solid rgba(255, 255, 255, 0.3)",
                    borderRadius: "12px",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
                  }}
                  formatter={(value: number) => [`Rs. ${Math.round(value)}`, "Revenue"]}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="url(#salesGradient)"
                  strokeWidth={3}
                  dot={{ fill: "#667eea", r: 4 }}
                  activeDot={{ r: 6, fill: "#764ba2" }}
                />
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#667eea" />
                    <stop offset="100%" stopColor="#764ba2" />
                  </linearGradient>
                </defs>
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-sm text-slate-600">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 mx-auto mb-3 text-slate-400 opacity-50" />
                <p>No sales data available</p>
              </div>
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="glass-card rounded-2xl p-6 border border-white/20">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 rounded-lg bg-emerald-100">
              <ShoppingCart className="h-4 w-4 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Recent Transactions</h3>
          </div>
          
          <div className="space-y-4">
            {stats?.recentSales && stats.recentSales.length > 0 ? (
              stats.recentSales.slice(0, 5).map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-slate-50/50 border border-white/30 hover:bg-white/70 transition-colors"
                  data-testid={`sale-item-${sale.id}`}
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-800">{sale.customerName}</p>
                    <p className="text-xs text-slate-600">
                      {formatDateShort(sale.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-mono font-semibold text-slate-800">
                      Rs. {Math.round(parseFloat(sale.totalAmount)).toLocaleString()}
                    </p>
                    <Badge
                      variant={
                        sale.paymentStatus === "paid"
                          ? "default"
                          : sale.paymentStatus === "partial"
                          ? "secondary"
                          : "outline"
                      }
                      className={`glass-card border-white/20 ${
                        sale.paymentStatus === "paid" 
                          ? "bg-emerald-100 text-emerald-700" 
                          : sale.paymentStatus === "partial"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {sale.paymentStatus}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-[260px] flex items-center justify-center text-sm text-slate-600">
                <div className="text-center">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-3 text-slate-400 opacity-50" />
                  <p>No recent transactions</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Customers Section */}
      <div className="glass-card rounded-2xl p-6 border border-white/20">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 rounded-lg bg-purple-100">
            <Crown className="h-4 w-4 text-purple-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">Top 20 High Purchaser Customers</h3>
        </div>
        
        {stats?.topCustomers && stats.topCustomers.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-white/30">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-white/30 text-sm text-slate-600">
                  <th className="text-left py-4 px-6 font-semibold">Rank</th>
                  <th className="text-left py-4 px-6 font-semibold">Customer Name</th>
                  <th className="text-left py-4 px-6 font-semibold">Phone</th>
                  <th className="text-right py-4 px-6 font-semibold">Total Purchases</th>
                  <th className="text-right py-4 px-6 font-semibold">Transactions</th>
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
                      className="border-b border-white/30 last:border-0 hover:bg-white/50 transition-colors group"
                    >
                      <td className="py-4 px-6">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${rankBadge.bg} ${rankBadge.text} font-semibold text-sm`}>
                          {index < 3 ? (
                            <IconComponent className="h-4 w-4" />
                          ) : (
                            `#${index + 1}`
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-slate-500 to-slate-700 rounded-full flex items-center justify-center">
                            <span className="text-xs font-semibold text-white">
                              {customer.customerName?.charAt(0)?.toUpperCase() || 'N'}
                            </span>
                          </div>
                          <span className="font-semibold text-slate-800 group-hover:text-purple-600 transition-colors">
                            {customer.customerName || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-600">{customer.customerPhone || 'N/A'}</td>
                      <td className="py-4 px-6 text-right">
                        <span className="font-mono font-bold text-lg bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                          Rs. {Math.round(totalPurchases).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Badge variant="outline" className="glass-card border-white/20 text-slate-700">
                          {transactionCount} trans
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-sm text-slate-600">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto mb-3 text-slate-400 opacity-50" />
              <p>No customer data available</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}