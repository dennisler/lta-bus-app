/**
 * Vercel Serverless Function & Shared Express Handler for /api/bus
 *
 * Calls LTA DataMall Bus Arrival v3 API and returns a simplified list
 * of services with arrival minutes for the next two buses.
 */

export default async function busHandler(req, res) {
  const accountKey = process.env.LTA_ACCOUNT_KEY;

  // Before fetch: check credential
  if (!accountKey || !accountKey.trim()) {
    const errorBody = {
      error: 'LTA_ACCOUNT_KEY is not set. Add it in Vercel and redeploy.'
    };
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(503).json(errorBody);
    }
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(errorBody));
  }

  // Parse BusStopCode query parameter, defaults to 04121
  let busStopCode = '04121';
  if (req.query && (req.query.BusStopCode || req.query.busStopCode)) {
    const raw = (req.query.BusStopCode || req.query.busStopCode).toString().trim();
    if (raw) busStopCode = raw;
  } else if (req.url) {
    try {
      const parsedUrl = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
      const codeFromUrl = parsedUrl.searchParams.get('BusStopCode') || parsedUrl.searchParams.get('busStopCode');
      if (codeFromUrl && codeFromUrl.trim()) {
        busStopCode = codeFromUrl.trim();
      }
    } catch (_) {
      // fallback to default
    }
  }

  try {
    const upstreamUrl = `https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival?BusStopCode=${encodeURIComponent(busStopCode)}`;
    const upstreamResponse = await fetch(upstreamUrl, {
      headers: {
        AccountKey: accountKey.trim()
      }
    });

    // Set cache control as LTA refreshes every 20 seconds
    if (typeof res.setHeader === 'function') {
      res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40');
    }

    // Check response.ok before reading body (401 returns empty body)
    if (!upstreamResponse.ok) {
      const errorPayload = {
        error: `LTA DataMall responded with HTTP status ${upstreamResponse.status}`,
        upstreamStatus: upstreamResponse.status
      };
      if (typeof res.status === 'function' && typeof res.json === 'function') {
        return res.status(upstreamResponse.status).json(errorPayload);
      }
      res.statusCode = upstreamResponse.status;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(errorPayload));
    }

    const data = await upstreamResponse.json();
    // Treat empty Services array as "no buses running", not an error
    const services = Array.isArray(data?.Services) ? data.Services : [];

    const now = Date.now();
    const simplifiedList = services.map((service) => {
      const nextBuses = [];
      const busCandidates = [service.NextBus, service.NextBus2];

      for (const bus of busCandidates) {
        if (bus && typeof bus.EstimatedArrival === 'string') {
          const trimmed = bus.EstimatedArrival.trim();
          if (trimmed !== '') {
            const arrivalTime = new Date(trimmed).getTime();
            if (!Number.isNaN(arrivalTime)) {
              const diffMs = arrivalTime - now;
              // Round down to whole minutes as LTA's guide asks
              const wholeMinutes = Math.floor(diffMs / 60000);
              nextBuses.push(Math.max(0, wholeMinutes));
            }
          }
        }
      }

      return {
        ServiceNo: service.ServiceNo || '',
        nextBuses,
        nextBusMinutes: nextBuses,
        minutes: nextBuses
      };
    });

    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(200).json(simplifiedList);
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(simplifiedList));
  } catch (err) {
    const errorPayload = {
      error: 'Failed to communicate with LTA DataMall service.',
      upstreamStatus: 502
    };
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(502).json(errorPayload);
    }
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(errorPayload));
  }
}
