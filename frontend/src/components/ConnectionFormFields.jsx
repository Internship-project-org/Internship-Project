import React from 'react';

const TYPES = ['SQL Server', 'SAP HANA', 'Service Layer'];

export default function ConnectionFormFields({ value = {}, onChange = () => {}, disabled = false }) {
  const update = (field) => (event) => onChange({ ...value, [field]: event.target.value });
  return (
    <div className="form-grid">
      <label>Connection name<input disabled={disabled} value={value.name || ''} onChange={update('name')} placeholder="e.g. SAP B1 Mock" /></label>
      <label>Source type<select disabled={disabled} value={value.type || 'Service Layer'} onChange={update('type')}>{TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
      <label>Server / host<input disabled={disabled} value={value.host || ''} onChange={update('host')} placeholder="localhost" /></label>
      <label>Port<input disabled={disabled} type="number" value={value.port || ''} onChange={update('port')} placeholder="50000" /></label>
      <label>Database / company DB<input disabled={disabled} value={value.database || ''} onChange={update('database')} placeholder="SBODEMO" /></label>
      <label>Username<input disabled={disabled} value={value.username || ''} onChange={update('username')} autoComplete="off" /></label>
      <label className="full-width">Password<input disabled={disabled} type="password" value={value.password || ''} onChange={update('password')} autoComplete="new-password" placeholder="Enter source password" /></label>
      <p className="field-note full-width">Passwords must be encrypted by the backend before storage and must never be returned to the browser.</p>
    </div>
  );
}
