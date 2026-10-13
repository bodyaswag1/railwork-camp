// The BAS CAMP logo (assets-src/bas-camp-logo.webp: white lettering over a red rider, on black) cut into the
// pieces the site uses. Black is lifted to Night Run (#101314) so the patch sits flush on the dark pages.
//   node scripts/logo.mjs
import sharp from 'sharp';
const src = 'assets-src/bas-camp-logo.webp';
const night = { r: 16, g: 19, b: 20 };
const cut = async (region, width, out, opts = {}) => {
  const base = sharp(src).extract(region).resize({ width });
  const { info } = await base.clone().toBuffer({ resolveWithObject: true });
  const flat = await sharp({ create: { width: info.width, height: info.height, channels: 3, background: night } }).png().toBuffer();
  let img = sharp(await base.png().toBuffer()).composite([{ input: flat, blend: 'screen' }]);
  await (out.endsWith('.png') ? img.png({ compressionLevel: 9, palette: !!opts.palette }) : img.webp({ quality: 90 })).toFile(out);
  console.log(out, info.width, info.height);
};
await cut({ left: 372, top: 560, width: 1280, height: 832 }, 640, 'src/assets/brand/bas-camp-wordmark.png'); // the lettering
await cut({ left: 280, top: 90, width: 1440, height: 1820 }, 900, 'src/assets/brand/bas-camp-logo.png'); // lettering + rider
await cut({ left: 100, top: 100, width: 1800, height: 1800 }, 192, 'public/favicon.png');
await cut({ left: 100, top: 100, width: 1800, height: 1800 }, 180, 'public/apple-touch-icon.png');
