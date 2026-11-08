const ICON_PATHS = {
 graduation:'m2 9 10-5 10 5-10 5L2 9Zm4 2v6q6 5 12 0v-6M22 9v8',
 language:'M3 5h12M9 3v2M5 5c0 5 4 9 9 11M13 5c0 5-4 9-10 11M14 21l4-10 4 10M16 17h4',
 undo:'M9 4 4 9l5 5M4 9h9a7 7 0 0 1 0 14',
 mountain:'M3 20 10 6l4 7 3-5 5 12H3ZM8 10l2 3 2-3',
 overview:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
 journey:'M6 20c-5-8 17-7 12-15M6 20h.01M18 5h.01M16 3l2 2 3-1',
 tasks:'M8 6h12M8 12h12M8 18h12M3 6h.01M3 12h.01M3 18h.01',
 trophy:'M8 3h8v5a4 4 0 0 1-8 0V3ZM8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 12v7M8 21h8M9 19h6',
 chart:'M4 3v18h17M8 16v-4M13 16V7M18 16v-7',
 settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
 arrow:'M5 12h14M13 6l6 6-6 6',up:'M7 17 17 7M7 7h10v10',plus:'M12 5v14M5 12h14',check:'m5 12 4 4L19 6',
 close:'m6 6 12 12M6 18 18 6',moon:'M20 14A8 8 0 0 1 10 4a8.5 8.5 0 1 0 10 10Z',sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1',
 flame:'M13 3c1 6 6 7 6 12a7 7 0 0 1-14 0c0-3 2-5 4-7 0 4 2 5 2 5s3-4 2-10Z',
 flag:'M5 22V3M5 3c5-5 9 5 15 0v10c-6 5-10-5-15 0',lock:'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3',
 spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z',search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM15 15l6 6',
 edit:'m14 5 5 5M4 20l4-1L21 6l-4-4L4 15v5Z',trash:'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',
 download:'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',upload:'M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4',
 menu:'M4 6h16M4 12h16M4 18h16',book:'M12 5v15M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2V4Z',
 code:'m8 5-6 7 6 7M16 5l6 7-6 7M14 3l-4 18',target:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM12 11v2',
 calendar:'M4 5h16v16H4zM8 2v6M16 2v6M4 10h16',heart:'M12 21 3 12C-2 4 7-1 12 7c5-8 14-3 9 5l-9 9Z'
};
function icon(name, cls='') { return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON_PATHS[name]||ICON_PATHS.spark}"/></svg>`; }
let sceneCounter=0;
function landscape(kind='mountain') {
  const id=`scene-${++sceneCounter}`;
  const mountains=`<path d="M0 230 110 102 180 170 318 37 465 193 545 110 720 265V360H0Z" fill="#496873"/><path d="m318 37-91 108 49-20 20 11 22-28 21 22 24-5 24 27Z" fill="#d8e7df"/><path d="m318 37 147 156-106-58-16-47Z" fill="#829c9d"/><path d="M0 283 120 180 224 257 330 169 490 286 610 179 720 255v105H0Z" fill="#244e56"/><path d="M0 309 140 265 295 319 470 239 720 324v36H0Z" fill="#14383c"/>`;
  const trees=Array.from({length:16},(_,i)=>{const x=i*51-20,y=210+(i%4)*22,h=50+(i%3)*18;return `<path d="m${x} ${y} ${h/3} ${h}h-${h/1.5}Z" fill="${i%2?'#173f3c':'#204f47'}"/><path d="M${x} ${y+h-4}v18" stroke="#163c36" stroke-width="4"/>`;}).join('');
  const city=Array.from({length:14},(_,i)=>{const x=i*56-12,h=60+(i*47)%130;return `<path d="M${x} 315V${315-h}h37v${h}" fill="${i%2?'#254750':'#1c3944'}"/><path d="M${x+10} ${330-h}v${h-30}m15 0v-${h-30}" stroke="#90b4a2" stroke-width="3" stroke-dasharray="5 11" opacity=".55"/>`;}).join('');
  return `<svg class="landscape" viewBox="0 0 720 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="${id}" x2="0" y2="1"><stop stop-color="#162e3b"/><stop offset="1" stop-color="#658c87"/></linearGradient></defs><path fill="url(#${id})" d="M0 0h720v360H0z"/><circle cx="554" cy="78" r="36" fill="#e7e6c4"/><g fill="none" stroke="#b0c8bc" opacity=".16"><path d="M-60 80Q180-20 420 130T780 110M-60 100Q180 0 420 150T780 130M-60 120Q180 20 420 170T780 150"/></g>${mountains}${kind==='city'?city:''}${kind==='forest'||kind==='hills'?trees:''}<path d="M0 342q180-38 300-9t420-6v33H0Z" fill="#0e292f"/><path d="M323 360q50-30 17-39t18-35" fill="none" stroke="#d9cf9e" stroke-width="2" opacity=".5"/></svg>`;
}
function landmark(c) {
  if(c.altitude>=1000) return landscape(c.altitude<3000?'hills':'mountain');
  const tower=c.altitude>=120 && c.id!==12;
  const drawings={
    1:'<path d="m110 210 90-130 90 130H110Zm90-130v130m0-83-32 83h64l-32-83M200 80V38m0 0 46 12-46 13"/>',
    2:'<path d="M140 200V60h60M167 42h65v43h-65zM180 85l8 30h25l8-30"/><ellipse cx="200" cy="85" rx="22" ry="5"/><path d="m184 91 30 22m-28-3 29-19"/>',
    3:'<path d="m155 210 6-69h25l2-85 14-12 18 7v15h-18v81l14 63m-50-60-25 60m40-60 15 60M140 142l-13-17m53-93-4-17m18 15 8-16"/>',
    5:'<path d="M194 210V52h12v158M154 75h92M170 62v25m60-25v25M194 98l-40-23m52 23 40-23M80 85q45 30 90-12m60 0q45 40 100 8M180 210h40"/>',
    12:'<path d="m85 207 115-159 115 159H85Zm115-159 25 159"/>',
    17:'<path d="M200 25v40m-7 0h14m-14 0c-4 75-19 112-58 145h36q29-75 58 0h36c-39-33-54-70-58-145M169 153h62m-48-46h34m-46 80h58m-39-60 20 25m-22-3 24-29"/>',
    20:'<path d="M168 210h64M200 27v28m-10 0h20v25h-20zM178 80l7 24h30l7-24Zm0 25 7 24h30l7-24Zm0 25 7 24h30l7-24Zm0 25 7 24h30l7-24Zm4 25v30h36v-30"/>',
    22:'<path d="M190 210 197 107m6 0 7 103M200 25v50m-8 1h16l12 14-6 17h-28l-6-17 12-14Zm-12 14h40M175 210h50"/>',
    25:'<path d="m180 210 15-100m10 0 15 100M200 24v58m-14 0h28l-4 18h-20l-4-18Zm-1 68 30 30m-3-43-27 35M178 210h44"/>',
    27:'<path d="M170 210h60M178 210v-60h12V89h7V48h6v41h7v61h12v60M200 48V20m-10 90h20m-32 66h44M197 90v120m13-58v58"/>'
  };
  const drawing=drawings[c.id]||(c.id===6||c.id===10?'<path d="M200 215v-55m0-122-74 145h148L200 38Zm-65 116h130M150 123h100"/>':tower?'<path d="M160 212h80M174 212V104h52v108M184 104V63h32v41M200 63V28M174 135h52M174 160h52M174 185h52M191 104v108M209 104v108"/>':'<path d="M120 210h160M135 210v-85h130v85M120 125l80-65 80 65M185 210v-50h30v50M150 143h18v20h-18M232 143h18v20h-18"/>');
  return `<svg class="landmark-art" viewBox="0 0 400 250" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1" opacity=".14"><ellipse cx="200" cy="210" rx="160" ry="25"/><ellipse cx="200" cy="210" rx="120" ry="15"/><path d="M40 210h320M200 20v215" stroke-dasharray="3 6"/><circle cx="200" cy="125" r="95"/></g><g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${drawing}</g><text x="300" y="80" fill="currentColor" font-size="12" font-family="monospace">${c.altitude} m</text><path d="M295 95v103m-5 0h10m-10-103h10" stroke="currentColor" opacity=".5"/></svg>`;
}
