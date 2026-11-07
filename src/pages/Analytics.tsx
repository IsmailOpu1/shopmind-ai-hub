import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, MessageSquare, MousePointerClick, SearchX, ShoppingCart, Shuffle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  browserTimeZone,
  formatDay,
  formatPercent,
  funnel,
  GAP_REASON_LABEL,
  parseAnalytics,
  percent,
  type StoreAnalytics,
} from "@/lib/analytics";

const RANGES = [7, 30, 90] as const;
const BAR_COLOR = "hsl(217 91% 60%)"; // blue-500, the app's accent

type Tile = { title: string; value: string; note: string; icon: typeof MessageSquare };

const Analytics = () => {
  const { user } = useAuth();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [data, setData] = useState<StoreAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle()
      .then(({ data: business, error: lookupError }) => {
        if (business) setBusinessId(business.id);
        else {
          if (lookupError) setError("Couldn't load your store. Please refresh the page.");
          setLoading(false);
        }
      });
  }, [user]);

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void supabase
      .rpc("store_analytics", { p_business_id: businessId, p_days: days, p_tz: browserTimeZone() })
      .then(({ data: raw, error: rpcError }) => {
        if (cancelled) return;
        if (rpcError) setError("Couldn't load analytics. Please refresh the page.");
        else setData(parseAnalytics(raw));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId, days]);

  return (
    <AnalyticsView
      days={days}
      onDaysChange={setDays}
      data={data}
      loading={loading}
      error={error}
      hasStore={!!businessId}
    />
  );
};

type ViewProps = {
  days: (typeof RANGES)[number];
  onDaysChange: (days: (typeof RANGES)[number]) => void;
  data: StoreAnalytics | null;
  loading: boolean;
  error: string | null;
  hasStore: boolean;
};

/** The page itself, from plain data (no fetching), so it can be previewed and tested. */
export function AnalyticsView({ days, onDaysChange: setDays, data, loading, error, hasStore }: ViewProps) {
  const t = data?.totals;
  const tiles: Tile[] = useMemo(() => {
    if (!t) return [];
    return [
      {
        title: "Conversations",
        value: String(t.conversations),
        note: `${t.shopper_messages} shopper messages`,
        icon: MessageSquare,
      },
      {
        title: "Product clicks",
        value: String(t.view_clicks),
        note: `${formatPercent(percent(t.view_clicks, t.cards_shown))} of ${t.cards_shown} cards shown`,
        icon: MousePointerClick,
      },
      {
        title: "Add-to-cart clicks",
        value: String(t.cart_clicks),
        note: `${formatPercent(percent(t.cart_clicks, t.cards_shown))} of cards shown`,
        icon: ShoppingCart,
      },
      {
        title: "Unanswered questions",
        value: String(t.gap_questions),
        note: "no product matched",
        icon: SearchX,
      },
      {
        title: "Backup AI replies",
        value: formatPercent(percent(t.fallback_replies, t.replies)),
        note: `${t.fallback_replies} of ${t.replies} replies`,
        icon: Shuffle,
      },
    ];
  }, [t]);

  const steps = t ? funnel(t) : [];
  const maxStep = Math.max(1, ...steps.map((s) => s.value));
  const isEmpty = !!t && t.conversations === 0 && t.shopper_messages === 0 && t.cards_shown === 0;

  return (
    <div className="page-fade-in">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mb-2 text-4xl font-bold text-gradient-blue-purple">Analytics</h1>
          <p className="text-lg text-gray-400">How shoppers use your assistant</p>
        </div>
        <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setDays(r)}
              aria-pressed={days === r}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                days === r ? "bg-blue-500 text-white" : "text-gray-300 hover:text-white"
              }`}
            >
              {r} days
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</p>}

      {loading && !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => <div key={i} className="h-28 shimmer rounded-xl" />)}
        </div>
      ) : !hasStore ? (
        !error && <p className="text-gray-400">Set up your store first to see analytics.</p>
      ) : data && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {tiles.map((tile) => (
              <Card key={tile.title} className="stat-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">{tile.title}</CardTitle>
                  <tile.icon className="h-4 w-4 text-blue-400" aria-hidden />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-white">{tile.value}</p>
                  <p className="mt-1 text-xs text-gray-500">{tile.note}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {isEmpty && (
            <p className="mb-8 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
              No shopper chats in the last {days} days yet. Once your assistant is live on your site, numbers show
              up here. Test chats from the dashboard are not counted.
            </p>
          )}

          <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="stat-card lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <BarChart3 className="h-4 w-4 text-blue-400" aria-hidden /> Conversations per day
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64" aria-label={`Conversations per day, last ${days} days`} role="img">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.daily} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                      <XAxis
                        dataKey="day"
                        tickFormatter={formatDay}
                        tick={{ fill: "#9ca3af", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={24}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: "#9ca3af", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(255,255,255,0.05)" }}
                        contentStyle={{
                          background: "#111827",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 8,
                          color: "#f3f4f6",
                        }}
                        labelFormatter={(d) => formatDay(String(d))}
                        formatter={(value, name) => [value, name === "conversations" ? "Conversations" : "Messages"]}
                      />
                      <Bar dataKey="conversations" fill={BAR_COLOR} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="stat-card">
              <CardHeader>
                <CardTitle className="text-base text-white">Shopping funnel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {steps.map((s) => (
                  <div key={s.label}>
                    <div className="mb-1.5 flex items-baseline justify-between text-sm">
                      <span className="text-gray-300">{s.label}</span>
                      <span className="text-white">
                        {s.value}
                        {s.rateOfShown !== null && (
                          <span className="ml-2 text-xs text-gray-500">{formatPercent(s.rateOfShown)} of cards</span>
                        )}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${(s.value / maxStep) * 100}%`, background: BAR_COLOR, minWidth: s.value ? 4 : 0 }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="stat-card">
              <CardHeader>
                <CardTitle className="text-base text-white">Top questions</CardTitle>
              </CardHeader>
              <CardContent>
                {data.top_questions.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-gray-400">Question</TableHead>
                        <TableHead className="w-16 text-right text-gray-400">Asked</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.top_questions.map((q) => (
                        <TableRow key={q.question} className="border-white/10">
                          <TableCell className="text-gray-200">{q.question}</TableCell>
                          <TableCell className="text-right text-white">{q.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-gray-500">No questions yet.</p>
                )}
              </CardContent>
            </Card>

            <Card className="stat-card">
              <CardHeader>
                <CardTitle className="text-base text-white">Catalog gaps</CardTitle>
                <p className="text-sm text-gray-500">Questions your catalog couldn't answer. Consider stocking these.</p>
              </CardHeader>
              <CardContent>
                {data.gaps.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-gray-400">Question</TableHead>
                        <TableHead className="text-gray-400">Why</TableHead>
                        <TableHead className="w-16 text-right text-gray-400">Asked</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.gaps.map((g) => (
                        <TableRow key={g.question} className="border-white/10">
                          <TableCell className="text-gray-200">{g.question}</TableCell>
                          <TableCell className="text-xs text-gray-400">{GAP_REASON_LABEL[g.reason]}</TableCell>
                          <TableCell className="text-right text-white">{g.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-gray-500">No gaps found. Every question matched a product.</p>
                )}
              </CardContent>
            </Card>

            <Card className="stat-card lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base text-white">Products in chat</CardTitle>
              </CardHeader>
              <CardContent>
                {data.products.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-gray-400">Product</TableHead>
                        <TableHead className="text-right text-gray-400">Shown</TableHead>
                        <TableHead className="text-right text-gray-400">Views</TableHead>
                        <TableHead className="text-right text-gray-400">Add to cart</TableHead>
                        <TableHead className="text-right text-gray-400">Click rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.products.map((p) => (
                        <TableRow key={p.product_id} className="border-white/10">
                          <TableCell className="text-gray-200">{p.name}</TableCell>
                          <TableCell className="text-right text-white">{p.shown}</TableCell>
                          <TableCell className="text-right text-white">{p.views}</TableCell>
                          <TableCell className="text-right text-white">{p.carts}</TableCell>
                          <TableCell className="text-right text-gray-300">
                            {formatPercent(percent(p.views + p.carts, p.shown))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-gray-500">No products shown in chat yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

export default Analytics;
