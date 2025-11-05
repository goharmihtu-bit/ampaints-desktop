import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, TrendingUp, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard-stats"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your paint store operations</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
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
      iconBg: "bg-chart-1/10",
      iconColor: "text-chart-1",
    },
    {
      title: "Monthly Revenue",
      value: `Rs. ${Math.round(stats?.monthlySales.revenue || 0).toLocaleString()}`,
      subtitle: `${stats?.monthlySales.transactions || 0} transactions`,
      icon: TrendingUp,
      iconBg: "bg-chart-2/10",
      iconColor: "text-chart-2",
    },
    {
      title: "Inventory Value",
      value: `Rs. ${Math.round(stats?.inventory.totalStockValue || 0).toLocaleString()}`,
      subtitle: `${stats?.inventory.totalColors || 0} colors in stock`,
      icon: Package,
      iconBg: "bg-chart-3/10",
      iconColor: "text-chart-3",
    },
    {
      title: "Unpaid Bills",
      value: `Rs. ${Math.round(stats?.unpaidBills.totalAmount || 0).toLocaleString()}`,
      subtitle: `${stats?.unpaidBills.count || 0} pending`,
      icon: AlertCircle,
      iconBg: "bg-chart-4/10",
      iconColor: "text-chart-4",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-dashboard-title">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your paint store operations</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((card) => (
          <Card key={card.title} className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={`flex h-8 w-8 items-center justify-center rounded-md ${card.iconBg}`}>
                <card.icon className={`h-4 w-4 ${card.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono" data-testid={`text-${card.title.toLowerCase().replace(/\s+/g, '-')}-value`}>
                {card.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Sales Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.monthlyChart && stats.monthlyChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.monthlyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    tickFormatter={(value) => `Rs. ${Math.round(value)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                    formatter={(value: number) => [`Rs. ${Math.round(value)}`, "Revenue"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--chart-1))", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
                No sales data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.recentSales && stats.recentSales.length > 0 ? (
                stats.recentSales.slice(0, 5).map((sale) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                    data-testid={`sale-item-${sale.id}`}
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{sale.customerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(sale.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-mono font-medium">
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
                      >
                        {sale.paymentStatus}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                  No recent transactions
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top 20 Customers Section */}
      <Card>
        <CardHeader>
          <CardTitle>Top 20 High Purchaser Customers</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.topCustomers && stats.topCustomers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-sm text-muted-foreground">
                    <th className="text-left py-3 px-4 font-medium">Rank</th>
                    <th className="text-left py-3 px-4 font-medium">Customer Name</th>
                    <th className="text-left py-3 px-4 font-medium">Phone</th>
                    <th className="text-right py-3 px-4 font-medium">Total Purchases</th>
                    <th className="text-right py-3 px-4 font-medium">Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topCustomers.map((customer, index) => {
                    const totalPurchases = parseFloat(customer.totalPurchases.toString()) || 0;
                    const transactionCount = parseInt(customer.transactionCount.toString()) || 0;
                    
                    return (
                      <tr
                        key={`${customer.customerPhone}-${index}`}
                        className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <Badge 
                            variant={index < 3 ? "default" : "secondary"}
                            className={
                              index === 0 
                                ? "bg-yellow-500 hover:bg-yellow-600" 
                                : index === 1 
                                ? "bg-gray-400 hover:bg-gray-500" 
                                : index === 2 
                                ? "bg-amber-600 hover:bg-amber-700" 
                                : ""
                            }
                          >
                            #{index + 1}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-medium">{customer.customerName || 'N/A'}</td>
                        <td className="py-3 px-4 text-muted-foreground">{customer.customerPhone || 'N/A'}</td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-blue-600">
                          Rs. {Math.round(totalPurchases).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-muted-foreground">
                          {transactionCount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
              No customer data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
