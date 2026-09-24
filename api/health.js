/**
 * Vercel Serverless Function & Shared Express Handler for /api/health
 *
 * Reports whether the key is configured (keyConfigured) and whether LTA
 * answered, including the upstream HTTP status code.
 * Never prints the key or any part of it.
 */

export default async function healthHandler(req, res) {
  const accountKey = process.env.LTA_ACCOUNT_KEY;
  const keyConfigured = Boolean(accountKey && accountKey.trim().length > 0);

  if (typeof res.setHeader === 'function') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }

  // If key is not configured, do not call LTA
  if (!keyConfigured) {
    const report = {
      keyConfigured: false,
      ltaAnswered: false,
      upstreamStatus: null,
      message: 'LTA_ACCOUNT_KEY is not configured.'
    };
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(200).json(report);
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(report));
  }

  // Key is configured: verify connection with LTA DataMall
  try {
    const upstreamUrl = 'https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival?BusStopCode=04121';
    const upstreamResponse = await fetch(upstreamUrl, {
      headers: {
        AccountKey: accountKey.trim()
      }
    });

    const upstreamStatus = upstreamResponse.status;
    const ltaAnswered = true; // Upstream responded with an HTTP status

    const report = {
      keyConfigured: true,
      ltaAnswered,
      upstreamStatus,
      message: upstreamResponse.ok
        ? 'LTA DataMall responded successfully.'
        : `LTA DataMall returned status code ${upstreamStatus}.`
    };

    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(200).json(report);
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(report));
  } catch (err) {
    const report = {
      keyConfigured: true,
      ltaAnswered: false,
      upstreamStatus: null,
      message: 'Failed to establish connection to LTA DataMall.'
    };

    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(200).json(report);
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(report));
  }
}
