import sharp from "sharp";

const source = "public/brand/attnd-wordmark-source.png";
const { data, info } = await sharp(source)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const colors = {
  black: [0, 0, 0],
  white: [255, 255, 255],
  green: [0, 62, 51],
};

for (const [tone, color] of Object.entries(colors)) {
  const output = Buffer.alloc(info.width * info.height * 4);
  for (let index = 0; index < info.width * info.height; index += 1) {
    const inputOffset = index * 4;
    const outputOffset = index * 4;
    output[outputOffset] = color[0];
    output[outputOffset + 1] = color[1];
    output[outputOffset + 2] = color[2];
    output[outputOffset + 3] = data[inputOffset + 3];
  }

  await sharp(output, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 2 })
    .png()
    .toFile(`public/brand/attnd-wordmark-${tone}.png`);
}
