#!/usr/bin/env python3
"""Extract handwriting from a tablet-app PDF (PDF Expert, GoodNotes, …) into InkMind strokes.

Such PDFs draw each pen stroke as a *filled outline polygon* (variable-width pen).
We recover an approximate centerline by pairing the i-th point with the (n-1-i)-th
point of the outline (outline = one edge forward, the other edge back) and use the
pair distance as the pen width → pressure.

Usage: pdf_to_strokes.py input.pdf out.json [--scale 2] [--png-dir DIR]
Output: {"pages": [{"index", "width", "height", "strokes": InkStroke[]}]}
"""
import argparse, json, math, sys
import pymupdf

def outline_points(drawing):
    pts = []
    for it in drawing["items"]:
        kind = it[0]
        if kind == "l":
            if not pts or pts[-1] != (it[1].x, it[1].y):
                pts.append((it[1].x, it[1].y))
            pts.append((it[2].x, it[2].y))
        elif kind == "c":  # bezier: keep endpoints
            if not pts or pts[-1] != (it[1].x, it[1].y):
                pts.append((it[1].x, it[1].y))
            pts.append((it[4].x, it[4].y))
        elif kind == "re":
            r = it[1]
            pts += [(r.x0, r.y0), (r.x1, r.y0), (r.x1, r.y1), (r.x0, r.y1)]
    return pts

def centerline(pts):
    n = len(pts)
    if n < 4:
        return [(x, y, 1.0) for x, y in pts]
    half = n // 2
    out = []
    for i in range(half):
        ax, ay = pts[i]
        bx, by = pts[n - 1 - i]
        out.append(((ax + bx) / 2, (ay + by) / 2, math.hypot(ax - bx, ay - by)))
    return out

def rgb_to_argb(c):
    r, g, b = (int(round(v * 255)) for v in c)
    return (0xFF << 24) | (r << 16) | (g << 8) | b

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf"); ap.add_argument("out")
    ap.add_argument("--scale", type=float, default=2.0, help="PDF pt → canvas px")
    ap.add_argument("--png-dir", help="also write a centerline rendering per page for sanity checks")
    a = ap.parse_args()
    doc = pymupdf.open(a.pdf)
    pages = []
    t = 0
    for pi, page in enumerate(doc):
        strokes = []
        raw = []
        for di, d in enumerate(doc[pi].get_drawings()):
            if d.get("type") != "f":  # ruled lines etc. are strokes, pen is filled outlines
                continue
            fill = d.get("fill")
            if fill is None or (fill[0] > 0.85 and fill[1] > 0.85 and fill[2] > 0.85):
                continue  # skip white/very light fills (paper, highlighter glare)
            pts = outline_points(d)
            cl = centerline(pts)
            if len(cl) < 2:
                continue
            raw.append((di, fill, cl))
        # Pen width: the pairing heuristic fails on loops/dots and yields huge "widths"; use the
        # page-wide median as the nib size and clamp pressure so those become dots, not blobs.
        all_w = sorted(w for _, _, cl in raw for _, _, w in cl)
        nib = max(0.6, all_w[len(all_w) // 2]) if all_w else 1.0
        for di, fill, cl in raw:
            inputs = []
            for x, y, w in cl:
                t += 8
                inputs.append({"x": round(x * a.scale, 2), "y": round(y * a.scale, 2), "timeMillis": t,
                               "pressure": round(min(1.0, max(0.35, w / (nib * 1.6))), 3)})
            t += 120  # gap between strokes
            strokes.append({
                "id": f"pdf{pi+1}_{di}",
                "inputs": {"tool": "STYLUS", "inputs": inputs},
                "brush": {"stockBrush": "MARKER", "color": rgb_to_argb(fill), "size": round(nib * 1.6 * a.scale, 2)},
            })
        pages.append({"index": pi + 1, "width": page.rect.width * a.scale, "height": page.rect.height * a.scale, "strokes": strokes})
        print(f"page {pi+1}: {len(strokes)} strokes", file=sys.stderr)
        if a.png_dir:
            from PIL import Image, ImageDraw
            im = Image.new("RGB", (int(page.rect.width * a.scale), int(page.rect.height * a.scale)), "white")
            dr = ImageDraw.Draw(im)
            for s in strokes:
                ip = s["inputs"]["inputs"]
                for p, q in zip(ip, ip[1:]):
                    dr.line([(p["x"], p["y"]), (q["x"], q["y"])], fill="black", width=max(1, round(s["brush"]["size"] * p["pressure"])))
            im.save(f"{a.png_dir}/centerline-{pi+1}.png")
    json.dump({"source": a.pdf.split('/')[-1], "pages": pages}, open(a.out, "w"))

if __name__ == "__main__":
    main()
