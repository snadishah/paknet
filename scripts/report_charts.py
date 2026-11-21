"""Charts for the report, from docs/results/results.json -> docs/results/fig*.png.
Run by `npm run report` (or: python scripts/report_charts.py).

Style (dataviz reference instance): categorical slots in fixed order (blue,
orange, aqua; palette validated), one y-axis per panel (two measures -> two
panels), 2 px lines, recessive grid, direct labels plus a legend; every figure
has a table beside it in the report.
"""
import json, os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "docs", "results")
R = json.load(open(os.path.join(RES, "results.json"), encoding="utf-8"))

S1, S2, S3 = "#2a78d6", "#eb6834", "#1baf7a"
INK, INK2, GRID, SURFACE = "#0b0b0b", "#52514e", "#e6e5e1", "#ffffff"
plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 9, "axes.edgecolor": GRID, "axes.labelcolor": INK2,
    "xtick.color": INK2, "ytick.color": INK2, "axes.titlesize": 10, "axes.titleweight": "bold",
    "axes.titlecolor": INK, "axes.titlelocation": "left", "axes.grid": True, "grid.color": GRID,
    "grid.linewidth": 0.6, "axes.axisbelow": True, "axes.spines.top": False, "axes.spines.right": False,
    "lines.linewidth": 2, "legend.frameon": False, "figure.facecolor": SURFACE, "axes.facecolor": SURFACE,
})

def save(fig, name):
    fig.tight_layout()
    fig.savefig(os.path.join(RES, name), dpi=200)
    plt.close(fig)

# Fig 1: a day (two measures -> two panels)
d = R["daily"]; h = [x["hour"] for x in d]
fig, (a, b) = plt.subplots(1, 2, figsize=(7.2, 2.6))
a.plot(h, [x["intlTbps"] for x in d], color=S1, marker="o", markersize=4)
a.set_title("International traffic, busier direction"); a.set_ylabel("Tbps"); a.set_xlabel("hour of day (PKT)"); a.set_xticks(h)
b.plot(h, [x["lossPct"] for x in d], color=S1, marker="o", markersize=4)
b.set_title("Loss of legitimate traffic"); b.set_ylabel("%"); b.set_xlabel("hour of day (PKT)"); b.set_xticks(h); b.set_ylim(0, max(1, max(x["lossPct"] for x in d) * 1.3))
save(fig, "fig1_daily.png")

# Fig 2: cable cuts at 21:00
c = R["cuts"]; labels = [x["label"] for x in c][::-1]; y = range(len(c))
fig, (a, b) = plt.subplots(1, 2, figsize=(7.2, 3.0), gridspec_kw={"width_ratios": [1.5, 1]}, sharey=True)
cap = [x["capTbps"] for x in c][::-1]; used = [x["intlTbps"] for x in c][::-1]
a.barh([i + 0.2 for i in y], cap, height=0.36, color=S1, label="capacity")
a.barh([i - 0.2 for i in y], used, height=0.36, color=S2, label="traffic carried")
a.set_yticks(list(y)); a.set_yticklabels(labels); a.set_xlabel("Tbps"); a.set_title("Capacity and traffic carried"); a.legend(loc="lower right", fontsize=8)
loss = [x["lossPct"] for x in c][::-1]
b.barh(list(y), loss, height=0.5, color=S1)
for i, v in enumerate(loss): b.text(v + 1, i, f"{v:.1f}%", va="center", color=INK2, fontsize=8)
b.set_xlabel("%"); b.set_title("Loss"); b.set_xlim(0, max(loss) * 1.25)
save(fig, "fig2_cuts.png")

# Fig 3: RIP count-to-infinity at Nok Kundi
rip = R["rip"]; rounds = list(range(1, len(rip["none"]["nokKundi"]) + 1))
fig, a = plt.subplots(figsize=(7.2, 2.8))
a.step(rounds, rip["none"]["nokKundi"], where="post", color=S1, label="no split horizon")
a.step(rounds, rip["splitHorizon"]["nokKundi"], where="post", color=S2, label="split horizon", linestyle="--")
a.step(rounds, rip["poisonReverse"]["nokKundi"], where="post", color=S3, label="poison reverse (same as split horizon here)", linestyle=":")
a.axhline(16, color=INK2, linewidth=0.8); a.text(rounds[-1], 16.3, "16 = unreachable", ha="right", color=INK2, fontsize=8)
a.set_title("Nok Kundi's distance to Taftan after the cut (hop count)"); a.set_xlabel("RIP round (one round = 30 s)"); a.set_ylabel("hops"); a.set_ylim(0, 17.5)
a.legend(loc="lower right", fontsize=8)
save(fig, "fig3_rip.png")

# Fig 4: OSPF convergence and the black hole
o = R["ospf"]; fails = []
for x in o:
    if x["label"] not in fails: fails.append(x["label"])
get = lambda f, det, k: next(x[k] for x in o if x["label"] == f and x["detect"] == det)
y = list(range(len(fails)))[::-1]
fig, (a, b) = plt.subplots(1, 2, figsize=(7.2, 2.8), sharey=True)
for f, yy in zip(fails, y):
    a.barh(yy + 0.2, get(f, "carrier", "totalMs") / 1000, height=0.36, color=S1, label="loss of light" if yy == y[0] else None)
    a.barh(yy - 0.2, get(f, "hello", "totalMs") / 1000, height=0.36, color=S2, label="Hellos stop (40 s)" if yy == y[0] else None)
    b.barh(yy + 0.2, get(f, "carrier", "blackholedBundles"), height=0.36, color=S1)
    b.barh(yy - 0.2, get(f, "hello", "blackholedBundles"), height=0.36, color=S2)
a.set_xscale("log"); a.set_xlim(0.1, 100); a.xaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f"{v:g} s")); a.set_yticks(y); a.set_yticklabels(fails); a.set_xlabel("log scale"); a.set_title("Convergence time")
h_, l_ = a.get_legend_handles_labels(); b.legend(h_, l_, loc="lower right", fontsize=8)
b.set_xlabel("bundles (0.1 Gbit each)"); b.set_title("Traffic lost before convergence")
save(fig, "fig4_ospf.png")

# Fig 5: the 2008 hijack, replayed
rp = R["hijack"]["replay"]; steps = [f'{x["utc"]}\n{x["step"]}' for x in rp]; xs = range(len(rp))
fig, a = plt.subplots(figsize=(7.2, 2.8))
a.plot(xs, [x["world"] * 100 for x in rp], color=S1, marker="o", markersize=5, drawstyle="steps-post", label="world YouTube users sent to Pakistan")
a.plot(xs, [x["pakistan"] * 100 for x in rp], color=S2, marker="s", markersize=5, drawstyle="steps-post", linestyle="--", label="Pakistani users blocked")
a.set_xticks(list(xs)); a.set_xticklabels(steps, fontsize=7); a.set_ylabel("% of users"); a.set_ylim(-5, 110)
a.set_title("24 Feb 2008 in the BGP model (2008 rules)"); a.legend(loc="center right", fontsize=8)
save(fig, "fig5_hijack.png")

# Fig 6: DDoS, defence off vs on
dd = R["defence"]["ddos"]
fig, a = plt.subplots(figsize=(7.2, 2.8))
a.plot([p["t"] for p in dd["off"]["series"]], [p["lossPct"] for p in dd["off"]["series"]], color=S1, label="defence off")
a.plot([p["t"] for p in dd["on"]["series"]], [p["lossPct"] for p in dd["on"]["series"]], color=S2, label="defence on")
for t in (dd["on"]["detectMs"], dd["on"]["responseMs"]):
    if t is not None: a.axvline(t, color=INK2, linewidth=0.8, linestyle=":")
a.text(dd["on"]["responseMs"] + 0.3, a.get_ylim()[1] * 0.9, f"defence on: detected at {dd['on']['detectMs']} ms, diverted at {dd['on']['responseMs']} ms", color=INK2, fontsize=8)
a.set_title("Loss of legitimate traffic during an 8 Tbps flood"); a.set_xlabel("network time since the flood began (ms; 1 ms = 0.5 s on screen)"); a.set_ylabel("%")
a.legend(loc="upper right", fontsize=8)
save(fig, "fig6_ddos.png")
print("wrote 6 figures to docs/results/")
