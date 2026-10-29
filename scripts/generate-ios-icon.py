from pathlib import Path
import math
import struct
import zlib

SIZE = 1024
SAMPLES = 3
BACKGROUND = (0, 0, 0)
ACCENT = (0, 230, 220)


def rounded_rect(x: float, y: float, left: float, top: float, right: float, bottom: float, radius: float) -> bool:
    cx = min(max(x, left + radius), right - radius)
    cy = min(max(y, top + radius), bottom - radius)
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2


def in_ticket(x: float, y: float) -> bool:
    outer = rounded_rect(x, y, 236, 310, 788, 714, 74)
    if not outer:
        return False
    notch_radius = 48
    left_notch = (x - 236) ** 2 + (y - 512) ** 2 < notch_radius ** 2
    right_notch = (x - 788) ** 2 + (y - 512) ** 2 < notch_radius ** 2
    return not (left_notch or right_notch)


rows = []
for y in range(SIZE):
    scanline = bytearray([0])
    for x in range(SIZE):
        coverage = 0
        for sy in range(SAMPLES):
            for sx in range(SAMPLES):
                px = x + (sx + 0.5) / SAMPLES
                py = y + (sy + 0.5) / SAMPLES
                if in_ticket(px, py):
                    dash_gap = abs(px - 512) < 12 and int((py - 350) / 46) % 2 == 0
                    if not dash_gap:
                        coverage += 1
        ratio = coverage / (SAMPLES * SAMPLES)
        scanline.extend(round(BACKGROUND[channel] * (1 - ratio) + ACCENT[channel] * ratio) for channel in range(3))
    rows.append(bytes(scanline))


def chunk(kind: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)


png = b"\x89PNG\r\n\x1a\n"
png += chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 2, 0, 0, 0))
png += chunk(b"IDAT", zlib.compress(b"".join(rows), 9))
png += chunk(b"IEND", b"")

target = Path(__file__).resolve().parents[1] / "ios/EventPlatform/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png"
target.write_bytes(png)
print(target)
