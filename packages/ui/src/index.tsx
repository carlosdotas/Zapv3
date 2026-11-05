import type { ReactNode } from 'react';
export function Shell({ title, children }: { title: string; children: ReactNode }) { return <main style={{maxWidth: 520, margin: '0 auto', padding: 24, fontFamily: 'system-ui'}}><p style={{color:'#087f5b',fontWeight:700}}>ZAP ENCOMENDAS</p><h1>{title}</h1>{children}</main>; }
