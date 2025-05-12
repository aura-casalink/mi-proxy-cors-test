// api/preview.js
import ogs from 'open-graph-scraper';
import chromium from 'chrome-aws-lambda';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Permitir CORS desde tu dominio Carrd
  res.setHeader('Access-Control-Allow-Origin', 'https://auratest.carrd.co');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Solo GET permitido' });
  }

  const target = req.query.url;
  if (!target) {
    return res.status(400).json({ error: 'Falta el parámetro url' });
  }

  try {
    // 1) Intentamos extraer og:image
    const { result } = await ogs({ url: target });
    if (result.ogImage && result.ogImage.url) {
      // Redirigimos a la imagen OG directamente
      return res.redirect(307, result.ogImage.url);
    }

    // 2) Si no hay OG, tomamos un screenshot con Puppeteer
    const browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1200, height: 630 },
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.goto(target, { waitUntil: 'networkidle2', timeout: 15_000 });
    const screenshot = await page.screenshot({ type: 'jpeg', quality: 70 });
    await browser.close();

    res.setHeader('Content-Type', 'image/jpeg');
    return res.status(200).send(screenshot);

  } catch (err) {
    console.error('Error en preview:', err);
    // 3) Fallback: un placeholder sencillo
    const fallback = await fetch('https://via.placeholder.com/1200x630?text=No+preview');
    const buffer = await fallback.buffer();
    res.setHeader('Content-Type', 'image/png');
    return res.status(200).send(buffer);
  }
}
