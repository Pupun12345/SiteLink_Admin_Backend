const express = require('express');
const { protect } = require('../middleware/auth');

// ═══════════════════════════════════════════════════════════════════
//  GEO — admin job form ka naksha (jagah dhoondho / pin se pata)
// ═══════════════════════════════════════════════════════════════════
// Google key server par rehti hai (GOOGLE_MAPS_API_KEY) — browser me nahi
// jaati. Naksha khud OpenStreetMap par dikhta hai; Google sirf search
// aur pin → pata (address) ke liye.
const router = express.Router();
const GEOCODE = 'https://maps.googleapis.com/maps/api/geocode/json';

function key() {
  return process.env.GOOGLE_MAPS_API_KEY || '';
}

// GET /api/geo/search?q=Jajpur  → [{ address, lat, lng }]
router.get('/search', protect, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 120);
    if (q.length < 2) return res.json({ success: true, data: [] });
    if (!key()) return res.status(500).json({ success: false, message: 'Maps key not configured' });
    const url = `${GEOCODE}?address=${encodeURIComponent(q)}&region=in&components=country:IN&key=${key()}`;
    const g = await fetch(url).then((r) => r.json());
    if (g.status !== 'OK' && g.status !== 'ZERO_RESULTS') {
      return res.status(502).json({ success: false, message: `Maps search failed (${g.status})` });
    }
    const data = (g.results || []).slice(0, 6).map((r) => ({
      address: r.formatted_address,
      lat: r.geometry?.location?.lat,
      lng: r.geometry?.location?.lng,
    }));
    return res.json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Maps search failed' });
  }
});

// GET /api/geo/reverse?lat=..&lng=..  → { address }
router.get('/reverse', protect, async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ success: false, message: 'lat and lng are required' });
    }
    if (!key()) return res.status(500).json({ success: false, message: 'Maps key not configured' });
    const g = await fetch(`${GEOCODE}?latlng=${lat},${lng}&key=${key()}`).then((r) => r.json());
    return res.json({ success: true, data: { address: g.results?.[0]?.formatted_address || '' } });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Address lookup failed' });
  }
});

module.exports = router;
