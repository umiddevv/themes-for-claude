// A slow aurora over a polar ridge. Pure SVG + CSS: no script, nothing loaded.
// Dark sky by default; a pale dawn sky when the surface reports light mode.
const scene = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<style>
  .sky-top{stop-color:#050913}.sky-mid{stop-color:#0a1424}.sky-low{stop-color:#10203a}
  .ridge-far{fill:#0c1830}.ridge-near{fill:#070d1a}
  .star{fill:#dfe9ff;animation:tw 5s ease-in-out infinite}
  .band{mix-blend-mode:screen;transform-box:fill-box;transform-origin:50% 50%}
  .b1{animation:drift1 26s ease-in-out infinite alternate,pulse 9s ease-in-out infinite}
  .b2{animation:drift2 34s ease-in-out infinite alternate,pulse 13s ease-in-out infinite -4s}
  .b3{animation:drift3 41s ease-in-out infinite alternate,pulse 11s ease-in-out infinite -7s}
  .curtain{animation:sway 18s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:50% 0%}
  @keyframes tw{0%,100%{opacity:.25}50%{opacity:.9}}
  @keyframes pulse{0%,100%{opacity:.55}50%{opacity:.95}}
  @keyframes drift1{from{transform:translateX(-60px) skewX(-4deg)}to{transform:translateX(80px) skewX(5deg)}}
  @keyframes drift2{from{transform:translateX(70px) scaleY(.92)}to{transform:translateX(-90px) scaleY(1.08)}}
  @keyframes drift3{from{transform:translateX(-40px) skewX(6deg)}to{transform:translateX(60px) skewX(-5deg)}}
  @keyframes sway{from{transform:skewX(-3deg) scaleY(.95)}to{transform:skewX(3deg) scaleY(1.05)}}
  @media (prefers-color-scheme: light){
    .sky-top{stop-color:#cfdcec}.sky-mid{stop-color:#e2ebf5}.sky-low{stop-color:#eef3f9}
    .ridge-far{fill:#c3d2e3}.ridge-near{fill:#b2c4d9}
    .star{fill:#ffffff;opacity:.4;animation:none}
    .band{mix-blend-mode:multiply;opacity:.35}
  }
  @media (prefers-reduced-motion: reduce){*{animation:none!important}}
</style>
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" class="sky-top"/><stop offset=".55" class="sky-mid"/><stop offset="1" class="sky-low"/>
  </linearGradient>
  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#7cf5d4" stop-opacity="0"/><stop offset=".45" stop-color="#3ee0b0" stop-opacity=".85"/><stop offset="1" stop-color="#1aa38f" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#b48cff" stop-opacity="0"/><stop offset=".5" stop-color="#8a6fe0" stop-opacity=".7"/><stop offset="1" stop-color="#3ee0b0" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="g3" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#5ad1ff" stop-opacity="0"/><stop offset=".5" stop-color="#36b9e8" stop-opacity=".6"/><stop offset="1" stop-color="#7cf5d4" stop-opacity="0"/>
  </linearGradient>
  <filter id="soft" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="28"/></filter>
  <filter id="softer" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
</defs>
<rect width="1600" height="1000" fill="url(#sky)"/>
<g>
  <circle class="star" cx="120" cy="80" r="1.4"/><circle class="star" cx="260" cy="190" r="1" style="animation-delay:-1s"/>
  <circle class="star" cx="410" cy="60" r="1.2" style="animation-delay:-2.5s"/><circle class="star" cx="560" cy="150" r="0.9" style="animation-delay:-3s"/>
  <circle class="star" cx="720" cy="40" r="1.3" style="animation-delay:-.7s"/><circle class="star" cx="880" cy="120" r="1" style="animation-delay:-4s"/>
  <circle class="star" cx="1030" cy="70" r="1.5" style="animation-delay:-1.8s"/><circle class="star" cx="1180" cy="170" r="1" style="animation-delay:-3.6s"/>
  <circle class="star" cx="1320" cy="50" r="1.2" style="animation-delay:-2.2s"/><circle class="star" cx="1480" cy="130" r="1.1" style="animation-delay:-.3s"/>
  <circle class="star" cx="1550" cy="260" r="0.9" style="animation-delay:-4.4s"/><circle class="star" cx="60" cy="300" r="1" style="animation-delay:-2.9s"/>
  <circle class="star" cx="330" cy="330" r="0.8" style="animation-delay:-1.3s"/><circle class="star" cx="1250" cy="320" r="0.9" style="animation-delay:-3.1s"/>
</g>
<g filter="url(#soft)">
  <path class="band b1" fill="url(#g1)" d="M-100 260 C 200 120, 420 360, 760 220 S 1260 100, 1700 250 L 1700 420 C 1300 300, 1000 470, 720 380 S 200 300, -100 430 Z"/>
  <path class="band b2" fill="url(#g2)" d="M-100 160 C 300 60, 600 240, 900 140 S 1400 40, 1700 150 L 1700 300 C 1350 220, 1050 330, 820 260 S 300 210, -100 300 Z"/>
  <path class="band b3" fill="url(#g3)" d="M-100 340 C 260 260, 520 420, 880 330 S 1350 260, 1700 360 L 1700 470 C 1320 400, 1000 520, 760 450 S 260 400, -100 500 Z"/>
</g>
<g filter="url(#softer)" opacity=".5">
  <g class="curtain">
    <rect class="band" x="180" y="170" width="26" height="260" fill="url(#g1)"/>
    <rect class="band" x="340" y="200" width="18" height="230" fill="url(#g1)"/>
    <rect class="band" x="1120" y="140" width="24" height="250" fill="url(#g3)"/>
    <rect class="band" x="1290" y="180" width="20" height="230" fill="url(#g1)"/>
    <rect class="band" x="1430" y="150" width="28" height="260" fill="url(#g2)"/>
  </g>
</g>
<path class="ridge-far" d="M0 880 L120 830 L230 860 L380 790 L520 850 L660 810 L800 870 L960 800 L1100 850 L1260 780 L1420 840 L1600 800 L1600 1000 L0 1000 Z"/>
<path class="ridge-near" d="M0 930 L160 890 L300 920 L470 870 L640 915 L820 885 L1000 925 L1180 880 L1360 915 L1520 885 L1600 900 L1600 1000 L0 1000 Z"/>
</svg>`

export default scene
