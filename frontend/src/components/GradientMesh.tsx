import { useEffect, useRef } from "react";

export function GradientMesh() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
    if (isMobile) return;
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, antialias: true });
    if (!gl) return;

    const resize = () => {
      canvas.width = innerWidth; canvas.height = innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const vs = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
    const fs = `precision highp float;uniform vec2 R;uniform float T;uniform vec2 M;
      float n(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      float fbm(vec2 p){float v=0.;float a=0.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.03;a*=0.5;}return v;}
      void main(){
        vec2 u=(gl_FragCoord.xy-0.5*R)/R.y;
        vec2 m=(M-0.5*R)/R.y;
        float t=T*0.08;
        float f=fbm(u*1.4+vec2(t,-t*0.7)+m*0.4);
        float g=fbm(u*2.3-vec2(t*0.6,t)+m*0.2);
        vec3 a=vec3(0.00,0.78,0.59);
        vec3 b=vec3(0.22,0.74,0.97);
        vec3 c=vec3(0.65,0.55,0.98);
        vec3 col=mix(a,b,smoothstep(0.2,0.85,f));
        col=mix(col,c,smoothstep(0.35,0.95,g));
        float d=length(u-m*0.6);
        col+=0.08*exp(-d*2.2);
        col*=0.22;
        col+=vec3(0.015,0.02,0.04);
        gl_FragColor=vec4(col,1.0);
      }`;

    const mk = (t: number, s: string) => {
      const sh = gl.createShader(t)!;
      gl.shaderSource(sh, s); gl.compileShader(sh); return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog); gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uR = gl.getUniformLocation(prog, "R");
    const uT = gl.getUniformLocation(prog, "T");
    const uM = gl.getUniformLocation(prog, "M");

    let mx = innerWidth / 2, my = innerHeight / 2;
    const mm = (e: MouseEvent) => { mx = e.clientX; my = innerHeight - e.clientY; };
    window.addEventListener("mousemove", mm, { passive: true });

    let raf = 0;
    const start = performance.now();
    const loop = () => {
      const t = (performance.now() - start) / 1000;
      gl.uniform2f(uR, canvas.width, canvas.height);
      gl.uniform1f(uT, t);
      gl.uniform2f(uM, mx, my);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", mm);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", zIndex: 0, pointerEvents: "none", opacity: 0.85 }}
    />
  );
}
