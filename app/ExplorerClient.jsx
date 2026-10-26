'use client';

import dynamic from 'next/dynamic';

/**
 * The explorer is a single-page, WebGL-heavy client app: it is loaded only in the browser
 * so the static shell can be rendered (and exported) without a canvas on the server.
 */
const Explorer = dynamic(() => import('../src/App'), {
  ssr: false,
  loading: () => (
    <div className="boot">
      <img src="/logo.png" alt="" width="72" height="72" />
      <h1>Space Relics 3D</h1>
      <div className="spinner" />
      <p className="small muted">Warming up the Solar System…</p>
    </div>
  ),
});

export default function ExplorerClient() {
  return <Explorer />;
}
