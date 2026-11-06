import React from 'react';

export default function QueryPreview({ result, loading = false, error = '' }) {
  if (loading) return <section className="panel"><h3>Preview</h3><p>Running query…</p></section>;
  if (error) return <section className="panel error-panel"><h3>Preview failed</h3><p>{error}</p></section>;
  if (!result) return <section className="panel muted"><h3>Preview</h3><p>Run Test query to inspect up to the first 10 rows.</p></section>;
  const columns = result.columns?.length ? result.columns : Object.keys(result.rows?.[0] || {});
  return (
    <section className="panel">
      <div className="panel-heading"><h3>Preview results</h3><span>{result.rows?.length || 0} rows</span></div>
      {!columns.length ? <p>No rows returned.</p> : <div className="table-scroll"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{(result.rows || []).map((row, index) => <tr key={index}>{columns.map((column) => <td key={column}>{row[column] == null ? '—' : String(row[column])}</td>)}</tr>)}</tbody></table></div>}
      <small>Source: {result.meta?.source || '—'} · Preview limit: 10 rows</small>
    </section>
  );
}
