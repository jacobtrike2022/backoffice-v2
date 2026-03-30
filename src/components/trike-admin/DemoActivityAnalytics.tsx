import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import {
  Activity,
  Users,
  Clock3,
  MousePointerClick,
  RefreshCw,
  MapPin,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Separator } from "../ui/separator";
import { supabase } from "../../lib/supabase";
import { getServerUrl, publicAnonKey } from "../../utils/supabase/info";

type DemoEvent = {
  organization_id: string | null;
  organization_name_snapshot: string | null;
  event_type: string;
  path: string;
  track_title: string | null;
  visitor_id: string;
  session_id: string;
  occurred_at: string;
};

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const EVENT_COLORS = ["#f97316", "#3b82f6", "#10b981", "#a855f7", "#eab308", "#ef4444"];

function formatDuration(minutes: number): string {
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function formatDayKey(iso: string): string {
  return iso.slice(0, 10);
}

function formatDayLabel(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-").map((v) => Number(v));
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function DemoActivityAnalytics() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const [days, setDays] = useState("30");
  const [selectedOrg, setSelectedOrg] = useState("all");

  const loadEvents = async () => {
    setLoading(true);
    try {
      const daysNum = Number(days);
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token || publicAnonKey;
      const endpoint = `${getServerUrl()}/demo/activity?days=${daysNum}&limit=5000`;

      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
          apikey: publicAnonKey,
        },
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to fetch activity");
      }

      setEvents((payload?.data || []) as DemoEvent[]);
    } catch (error) {
      console.error("Failed to load demo activity analytics:", error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvents();
  }, [days]);

  const organizationOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of events) {
      const id = e.organization_id || "unknown";
      if (!seen.has(id)) {
        seen.set(id, e.organization_name_snapshot || "Unknown Org");
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (selectedOrg === "all") return events;
    if (selectedOrg === "unknown") return events.filter((e) => !e.organization_id);
    return events.filter((e) => e.organization_id === selectedOrg);
  }, [events, selectedOrg]);

  const metrics = useMemo(() => {
    const visitorSet = new Set<string>();
    const sessionSet = new Set<string>();
    const visitorSessions = new Map<string, Set<string>>();
    const sessions = new Map<string, DemoEvent[]>();

    for (const e of filteredEvents) {
      visitorSet.add(e.visitor_id);
      sessionSet.add(e.session_id);
      if (!visitorSessions.has(e.visitor_id)) visitorSessions.set(e.visitor_id, new Set());
      visitorSessions.get(e.visitor_id)?.add(e.session_id);
      if (!sessions.has(e.session_id)) sessions.set(e.session_id, []);
      sessions.get(e.session_id)?.push(e);
    }

    const returningVisitors = Array.from(visitorSessions.values()).filter((s) => s.size > 1).length;

    const sessionDurationsMinutes = Array.from(sessions.values()).map((sessionEvents) => {
      const sorted = [...sessionEvents].sort(
        (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
      );
      const startEvent = sorted.find((e) => e.event_type === "session_start");
      const endEvent = [...sorted].reverse().find((e) => e.event_type === "session_end");
      const start = new Date(startEvent?.occurred_at || sorted[0].occurred_at).getTime();
      const end = new Date(endEvent?.occurred_at || sorted[sorted.length - 1].occurred_at).getTime();
      const mins = Math.max(0, (end - start) / (1000 * 60));
      return Math.min(mins, 8 * 60); // hard cap for accidental open tabs
    });

    const avgSessionMinutes =
      sessionDurationsMinutes.length > 0
        ? sessionDurationsMinutes.reduce((a, b) => a + b, 0) / sessionDurationsMinutes.length
        : 0;

    return {
      totalEvents: filteredEvents.length,
      uniqueVisitors: visitorSet.size,
      uniqueSessions: sessionSet.size,
      returningVisitors,
      avgSessionMinutes,
    };
  }, [filteredEvents]);

  const eventsByDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of filteredEvents) {
      const key = formatDayKey(e.occurred_at);
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    const daysNum = Number(days);
    const output: Array<{ day: string; events: number }> = [];
    for (let i = daysNum - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      output.push({
        day: formatDayLabel(key),
        events: counts.get(key) || 0,
      });
    }
    return output;
  }, [filteredEvents, days]);

  const eventTypeData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of filteredEvents) {
      counts.set(e.event_type, (counts.get(e.event_type) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredEvents]);

  const orgBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) {
      const name = e.organization_name_snapshot || "Unknown Org";
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [events]);

  const topPaths = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of filteredEvents) {
      const path = e.path || "unknown";
      counts.set(path, (counts.get(path) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([path, clicks]) => ({ path, clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);
  }, [filteredEvents]);

  const topTracks = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of filteredEvents) {
      if (!e.track_title) continue;
      counts.set(e.track_title, (counts.get(e.track_title) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([track, opens]) => ({ track, opens }))
      .sort((a, b) => b.opens - a.opens)
      .slice(0, 10);
  }, [filteredEvents]);

  const recentEvents = useMemo(() => filteredEvents.slice(0, 20), [filteredEvents]);

  if (loading) {
    return (
      <div className="p-6 space-y-6 overflow-auto h-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="h-4 bg-muted rounded animate-pulse w-20 mb-3" />
                <div className="h-7 bg-muted rounded animate-pulse w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Demo Activity Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Org-level activity from `demo_activity_events` (Trike main + super-admin-unlocked traffic excluded).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedOrg} onValueChange={setSelectedOrg}>
            <SelectTrigger className="w-[230px]">
              <SelectValue placeholder="All organizations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All organizations</SelectItem>
              <SelectItem value="unknown">Unknown org</SelectItem>
              {organizationOptions.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={() => void loadEvents()}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Events" value={metrics.totalEvents.toString()} icon={Activity} />
        <MetricCard title="Unique Visitors" value={metrics.uniqueVisitors.toString()} icon={Users} />
        <MetricCard title="Sessions" value={metrics.uniqueSessions.toString()} icon={MousePointerClick} />
        <MetricCard
          title="Avg Session"
          value={formatDuration(metrics.avgSessionMinutes)}
          subtitle={`${metrics.returningVisitors} returning visitors`}
          icon={Clock3}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Activity Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={eventsByDay}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="events" stroke="#f97316" fill="#f97316" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Event Types</CardTitle>
          </CardHeader>
          <CardContent>
            {eventTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={eventTypeData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {eventTypeData.map((_, i) => (
                      <Cell key={`event-cell-${i}`} fill={EVENT_COLORS[i % EVENT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyBlock text="No events in selected range" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Org Activity Split</CardTitle>
          </CardHeader>
          <CardContent>
            {orgBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={orgBreakdown} cx="50%" cy="50%" outerRadius={90} dataKey="value" nameKey="name">
                    {orgBreakdown.map((_, i) => (
                      <Cell key={`org-cell-${i}`} fill={EVENT_COLORS[i % EVENT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyBlock text="No org activity yet" />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Pages Clicked / Visited</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topPaths.length > 0 ? (
              topPaths.map((row) => (
                <div key={row.path} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{row.path}</span>
                  </div>
                  <Badge variant="outline">{row.clicks}</Badge>
                </div>
              ))
            ) : (
              <EmptyBlock text="No page activity yet" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Tracks Opened</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topTracks.length > 0 ? (
              topTracks.map((row) => (
                <div key={row.track} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{row.track}</span>
                  </div>
                  <Badge variant="outline">{row.opens}</Badge>
                </div>
              ))
            ) : (
              <EmptyBlock text="No track opens yet" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentEvents.length > 0 ? (
              recentEvents.map((e, i) => (
                <div key={`${e.session_id}-${e.occurred_at}-${i}`} className="text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="secondary" className="shrink-0">
                        {e.event_type}
                      </Badge>
                      <span className="truncate">{e.organization_name_snapshot || "Unknown Org"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(e.occurred_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {e.path}
                    {e.track_title ? ` • ${e.track_title}` : ""}
                  </div>
                  {i < recentEvents.length - 1 && <Separator className="mt-2" />}
                </div>
              ))
            ) : (
              <EmptyBlock text="No recent activity yet" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{title}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="h-36 flex items-center justify-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

