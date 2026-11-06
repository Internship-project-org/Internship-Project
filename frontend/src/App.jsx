import React, { useState } from 'react';
import QuerySetup from './pages/QuerySetup';
import './styles.css';

export default function App() {
  const [active, setActive] = useState('Query setup');
  const menu = ['Job Dashboard', 'Recipient Lists', 'Templates', 'Run History', 'Connections', 'Queries', 'Query setup'];
  return (
    <div className="app-shell">
      <header className="topbar"><div className="brand-mark">N</div><strong>Notification Engine</strong><span className="batch-label">BATCH 2 · DATA CONNECTORS</span></header>
      <div className="workspace">
        <aside className="sidebar"><p className="nav-caption">WORKSPACE</p>{menu.map((item) => <button key={item} className={active === item ? 'nav-item active' : 'nav-item'} onClick={() => setActive(item)}>{item}</button>)}</aside>
        <main className="main-content">{active === 'Query setup' || active === 'Queries' ? <QuerySetup /> : <section className="panel"><h1>{active}</h1><p>This section belongs to the shared application or another team member's implementation. It is not implemented in this Batch 2 starter.</p></section>}</main>
      </div>
    </div>
  );
}
