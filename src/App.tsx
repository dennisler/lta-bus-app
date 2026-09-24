import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bus, RefreshCw, AlertCircle, CheckCircle2, Clock, Search, ShieldAlert, ArrowRight } from 'lucide-react';

interface BusServiceData {
  ServiceNo: string;
  nextBuses?: number[];
  nextBusMinutes?: number[];
  minutes?: number[];
}

interface HealthStatus {
  keyConfigured: boolean;
  ltaAnswered: boolean;
  upstreamStatus: number | null;
  message?: string;
}

const COMMON_BUS_STOPS = [
  { code: '04121', name: 'Old Hill St Police Stn', desc: 'Clarke Quay / Hill St' },
  { code: '01012', name: 'Hotel Grand Pacific', desc: 'Victoria St' },
  { code: '09048', name: 'Opp Orchard Stn', desc: 'Orchard Rd' },
  { code: '80019', name: 'Eunos Int', desc: 'Sims Ave' },
  { code: '10169', name: 'VivoCity', desc: 'Telok Blangah Rd' }
];

export default function App() {
  const [busStopCode, setBusStopCode] = useState<string>('04121');
  const [inputCode, setInputCode] = useState<string>('04121');
  const [services, setServices] = useState<BusServiceData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<number>(20);
  const [health, setHealth] = useState<HealthStatus | null>(null);

  const countdownRef = useRef<number>(20);

  // Dynamic access date for licence compliance
  const accessDate = React.useMemo(() => {
    const today = new Date();
    return today.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, []);

  // Check health status once on mount
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data: HealthStatus = await res.json();
        setHealth(data);
      }
    } catch {
      // ignore background health check failures
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  // Fetch bus arrival data
  const fetchBusArrivals = useCallback(async (isManual = false) => {
    if (isManual) {
      setRefreshing(true);
    }
    setError(null);

    try {
      const res = await fetch(`/api/bus?BusStopCode=${encodeURIComponent(busStopCode)}`);
      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data?.error || `Server responded with status ${res.status}`;
        setError(errorMsg);
        setServices([]);
      } else {
        const list: BusServiceData[] = Array.isArray(data)
          ? data
          : (data.services || data.Services || []);
        
        // Sort services naturally (e.g. 2, 12, 147, 190, NR1)
        const sorted = [...list].sort((a, b) => {
          return a.ServiceNo.localeCompare(b.ServiceNo, undefined, { numeric: true });
        });

        setServices(sorted);
        setLastUpdated(new Date());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve bus arrival information');
    } finally {
      setLoading(false);
      setRefreshing(false);
      countdownRef.current = 20;
      setCountdown(20);
    }
  }, [busStopCode]);

  // Initial load and whenever busStopCode changes
  useEffect(() => {
    setLoading(true);
    fetchBusArrivals();
  }, [fetchBusArrivals]);

  // 20-second automatic refresh timer
  useEffect(() => {
    countdownRef.current = 20;
    setCountdown(20);

    const timer = setInterval(() => {
      countdownRef.current -= 1;
      if (countdownRef.current <= 0) {
        countdownRef.current = 20;
        setCountdown(20);
        fetchBusArrivals();
      } else {
        setCountdown(countdownRef.current);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchBusArrivals]);

  const handleStopSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputCode.trim();
    if (clean) {
      setBusStopCode(clean);
    }
  };

  const selectStop = (code: string) => {
    setInputCode(code);
    setBusStopCode(code);
  };

  // Format arrival minutes to adhere strictly to:
  // "rounding down to whole minutes as LTA's guide asks, showing 'Arriving' under one minute"
  const renderArrivalBadge = (minutes: number, label: string) => {
    const isArriving = minutes < 1;
    return (
      <div className="flex flex-col items-center">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
          {label}
        </span>
        <div
          className={`px-3.5 py-1.5 rounded-lg font-mono font-bold text-sm tracking-wide border transition-all ${
            isArriving
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm animate-pulse'
              : minutes <= 5
              ? 'bg-amber-50 text-amber-900 border-amber-300'
              : 'bg-slate-100 text-slate-800 border-slate-200'
          }`}
        >
          {isArriving ? 'Arriving' : `${minutes} min`}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:py-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-inner">
              <Bus className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
                SG Bus Arrival
              </h1>
              <p className="text-xs text-slate-400">
                Live DataMall Arrival Timings
              </p>
            </div>
          </div>

          {/* Service health indicator */}
          <div className="flex items-center gap-2">
            {health ? (
              health.keyConfigured ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  LTA Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-950 text-rose-300 border border-rose-800">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  Key Not Configured
                </span>
              )
            ) : null}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Bus Stop Selection Bar */}
        <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <form onSubmit={handleStopSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="Enter 5-digit Bus Stop Code (e.g. 04121)"
                maxLength={5}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm font-mono tracking-wider font-semibold"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Load Stop</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick preset stop chips */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Quick select:</span>
            {COMMON_BUS_STOPS.map((stop) => (
              <button
                key={stop.code}
                onClick={() => selectStop(stop.code)}
                type="button"
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors cursor-pointer ${
                  busStopCode === stop.code
                    ? 'bg-blue-50 border-blue-400 text-blue-700 font-semibold'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <span className="font-mono font-bold mr-1">{stop.code}</span>
                <span className="hidden sm:inline text-slate-500">({stop.name})</span>
              </button>
            ))}
          </div>
        </section>

        {/* Live Status & Refresh Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Stop <span className="font-mono text-blue-600 font-black">{busStopCode}</span>
            </h2>
            {lastUpdated && (
              <span className="text-xs text-slate-500 hidden sm:inline">
                • Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-200/70 px-3 py-1.5 rounded-lg">
              <Clock className="w-3.5 h-3.5 text-slate-600" />
              <span>Auto-refresh:</span>
              <span className="font-mono font-bold text-slate-800 w-5 text-center">
                {countdown}s
              </span>
            </div>

            <button
              onClick={() => fetchBusArrivals(true)}
              disabled={refreshing || loading}
              type="button"
              className="px-3 py-1.5 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
              title="Refresh arrivals now"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Error notification banner */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold text-rose-900 mb-0.5">Unable to load bus arrivals</div>
              <div className="text-rose-700 font-mono text-xs">{error}</div>
              {error.includes('LTA_ACCOUNT_KEY') && (
                <div className="mt-2 text-xs text-rose-800">
                  Please set your <code className="bg-rose-100 px-1 py-0.5 rounded font-bold">LTA_ACCOUNT_KEY</code> in Vercel Project Settings or AI Studio Secrets.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live Arrival Panel */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {loading && !refreshing ? (
            <div className="py-16 text-center">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600">
                Fetching real-time arrivals for stop {busStopCode}...
              </p>
            </div>
          ) : services.length === 0 ? (
            <div className="py-16 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Bus className="w-6 h-6" />
              </div>
              <p className="text-slate-800 font-medium text-base">
                No buses currently running.
              </p>
              <p className="text-slate-500 text-xs mt-1">
                There are no active bus services scheduled at bus stop {busStopCode} right now.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {services.map((service) => {
                const arrivalMinutes = service.nextBuses || service.nextBusMinutes || service.minutes || [];
                const hasBuses = arrivalMinutes.length > 0;

                return (
                  <div
                    key={service.ServiceNo}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                  >
                    {/* Service Number Badge */}
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-12 rounded-xl bg-slate-900 text-white font-mono font-black text-xl flex items-center justify-center tracking-tight shadow-sm">
                        {service.ServiceNo}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Service
                        </div>
                        <div className="text-sm font-bold text-slate-900">
                          Bus {service.ServiceNo}
                        </div>
                      </div>
                    </div>

                    {/* Arrivals display */}
                    <div className="flex items-center sm:justify-end gap-3 sm:gap-5">
                      {!hasBuses ? (
                        <div className="text-sm text-slate-500 italic py-1">
                          No buses currently running for this service.
                        </div>
                      ) : (
                        <>
                          {arrivalMinutes[0] !== undefined &&
                            renderArrivalBadge(arrivalMinutes[0], 'Next Bus')}
                          {arrivalMinutes[1] !== undefined &&
                            renderArrivalBadge(arrivalMinutes[1], 'Following Bus')}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Informative Legend */}
        <section className="bg-slate-100 rounded-xl p-4 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-3 border border-slate-200">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">Timing Legend:</span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-emerald-600 inline-block" />
              Arriving (&lt;1 min)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block" />
              &le; 5 min
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-slate-300 inline-block" />
              &gt; 5 min
            </span>
          </div>
          <div className="text-slate-500">
            LTA DataMall updates every 20 seconds.
          </div>
        </section>
      </main>

      {/* Footer strictly complying with the licence wording requirement */}
      <footer className="bg-white border-t border-slate-200 py-6 px-4 mt-auto">
        <div className="max-w-4xl mx-auto text-xs leading-relaxed text-slate-500 text-center">
          Contains information from LTA DataMall Bus Arrival accessed on {accessDate} from the Land Transport Authority (LTA DataMall), which is made available under the terms of the Singapore Open Data Licence version 1.0{' '}
          <a
            href="https://data.gov.sg/open-data-licence"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-800 transition-colors inline-block"
          >
            https://data.gov.sg/open-data-licence
          </a>
          . This is an SMU course project and is not affiliated with or endorsed by the Land Transport Authority.
        </div>
      </footer>
    </div>
  );
}
