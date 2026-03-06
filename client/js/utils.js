// ─── Simplex Noise ────────────────────────────────────────────────────────
// Based on Stefan Gustavson's public-domain implementation
(function(){
  function buildPermutation() {
    const p = [];
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    return perm;
  }

  const grad3 = [
    [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
    [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
    [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
  ];

  function dot(g, x, y) { return g[0]*x + g[1]*y; }

  function noise2D(perm, xin, yin) {
    const F2 = 0.5*(Math.sqrt(3)-1);
    const G2 = (3-Math.sqrt(3))/6;
    const s = (xin+yin)*F2;
    const i = Math.floor(xin+s), j = Math.floor(yin+s);
    const t = (i+j)*G2;
    const X0=i-t, Y0=j-t;
    const x0=xin-X0, y0=yin-Y0;
    let i1,j1;
    if (x0>y0){i1=1;j1=0;}else{i1=0;j1=1;}
    const x1=x0-i1+G2, y1=y0-j1+G2;
    const x2=x0-1+2*G2, y2=y0-1+2*G2;
    const ii=i&255, jj=j&255;
    const gi0=perm[ii+perm[jj]]%12;
    const gi1=perm[ii+i1+perm[jj+j1]]%12;
    const gi2=perm[ii+1+perm[jj+1]]%12;
    let n0,n1,n2;
    let t0=0.5-x0*x0-y0*y0; if(t0<0)n0=0;else{t0*=t0;n0=t0*t0*dot(grad3[gi0],x0,y0);}
    let t1=0.5-x1*x1-y1*y1; if(t1<0)n1=0;else{t1*=t1;n1=t1*t1*dot(grad3[gi1],x1,y1);}
    let t2=0.5-x2*x2-y2*y2; if(t2<0)n2=0;else{t2*=t2;n2=t2*t2*dot(grad3[gi2],x2,y2);}
    return 70*(n0+n1+n2);
  }

  class SimplexNoise {
    constructor(seed) {
      // Seeded permutation
      const p = [];
      for (let i = 0; i < 256; i++) p[i] = i;
      let s = (seed || 12345) & 0xffffffff;
      for (let i = 255; i > 0; i--) {
        s = (s ^ (s << 13)) >>> 0;
        s = (s ^ (s >>> 17)) >>> 0;
        s = (s ^ (s << 5)) >>> 0;
        const j = s % (i + 1);
        [p[i], p[j]] = [p[j], p[i]];
      }
      this.perm = new Uint8Array(512);
      for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    }
    noise2D(x, y) { return noise2D(this.perm, x, y); }
    /** Fractal brownian motion */
    fbm(x, y, octaves=4, lacunarity=2, persistence=0.5) {
      let v=0, amp=1, freq=1, max=0;
      for (let i=0;i<octaves;i++){
        v += this.noise2D(x*freq, y*freq)*amp;
        max += amp; amp *= persistence; freq *= lacunarity;
      }
      return v/max;
    }
  }

  window.SimplexNoise = SimplexNoise;
})();

// ─── Math helpers ─────────────────────────────────────────────────────────
const MathUtils = {
  clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },
  lerp(a, b, t) { return a + (b-a)*t; },
  sign(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; },

  /** Convert world coords to chunk coords */
  worldToChunk(x, z, size=16) {
    return {
      cx: Math.floor(x / size),
      cz: Math.floor(z / size)
    };
  },

  /** Local coords within chunk */
  worldToLocal(x, z, size=16) {
    return {
      lx: ((x % size) + size) % size,
      lz: ((z % size) + size) % size
    };
  },

  degToRad(d) { return d * Math.PI / 180; },
  radToDeg(r) { return r * 180 / Math.PI; }
};
