
import React, { useState } from 'react';
import api, { previewSavedQuery } from '../api/previewApi';
import QueryPreview from '../components/QueryPreview';

export default function QuerySetup() {
  const [queryId, setQueryId] = useState('');
  const [name, setName] = useState('');
  const [connectionId, setConnectionId] = useState('');

  const [kind, setKind] = useState('odata');
  const [entity, setEntity] = useState('Invoices');
  const [filter, setFilter] = useState("DocStatus eq 'O'");
  const [select, setSelect] = useState(
    'DocNum,CardCode,CardName,DocTotal,DocDueDate'
  );
  const [queryText, setQueryText] = useState('');

  const [rowLimit, setRowLimit] = useState(1000);

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Validate the form before saving
  function validateForm() {
    if (!name.trim()) {
      throw new Error('Please enter a query name.');
    }

    if (!connectionId.trim()) {
      throw new Error('Please enter a connection ID.');
    }

    if (kind === 'odata' && !entity.trim()) {
      throw new Error('Please select a Service Layer entity.');
    }

    if (kind === 'sql' && !queryText.trim()) {
      throw new Error('Please enter an SQL query.');
    }

    if (!Number.isInteger(Number(rowLimit)) ||
        Number(rowLimit) < 1 ||
        Number(rowLimit) > 1000) {
      throw new Error('Row limit must be between 1 and 1000.');
    }
  }

  // Save query using the existing Query Management API
  async function saveQuery() {
    setSaving(true);
    setError('');
    setSuccess('');
    setPreview(null);

    try {
      validateForm();

      const queryData = {
        name: name.trim(),
        connectionId: connectionId.trim(),
        kind,
        queryText: kind === 'sql' ? queryText.trim() : '',
        entity: kind === 'odata' ? entity : '',
        filter: kind === 'odata' ? filter.trim() : '',
        select: kind === 'odata' ? select.trim() : '',
        rowLimit: Number(rowLimit)
      };

      const response = await api.post('/queries', queryData);

      // Support common API response structures
      const savedQuery =
        response.data?.data ||
        response.data?.query ||
        response.data;

      const savedId = savedQuery?._id || savedQuery?.id;

      if (!savedId) {
        throw new Error(
          'Query may have been saved, but the API did not return its ID.'
        );
      }

      setQueryId(savedId);
      setSuccess('Query saved successfully! You can now test your query.');

    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        'Unable to save query.'
      );
    } finally {
      setSaving(false);
    }
  }

  // Preview an already saved query
  async function testQuery() {
    setLoading(true);
    setError('');
    setSuccess('');
    setPreview(null);

    try {
      if (!queryId.trim()) {
        throw new Error('Please save a query or enter an existing saved query ID.');
      }

      const result = await previewSavedQuery(queryId.trim());

      setPreview(result);
      setSuccess('Query executed successfully.');

    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        'Unable to preview query.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-stack">

      {/* Page Header */}
      <header className="page-header">
        <div>
          <p className="eyebrow">BATCH 2 · DATA CONNECTORS</p>

          <h1>Query Setup and Testing</h1>

          <p>
            Create a saved query and inspect its source data
            before integration.
          </p>
        </div>
      </header>

      {/* Query Configuration */}
      <section className="panel">

        <h2>Query Configuration</h2>

        <div className="form-grid">

          {/* Query Name */}
          <label>
            Saved Query Name

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Overdue invoices"
            />
          </label>

          {/* Query ID */}
          <label>
            Saved Query ID

            <input
              type="text"
              value={queryId}
              onChange={(e) => setQueryId(e.target.value)}
              placeholder="Automatically filled after saving"
            />
          </label>

          {/* Connection ID */}
          <label>
            Connection ID

            <input
              type="text"
              value={connectionId}
              onChange={(e) => setConnectionId(e.target.value)}
              placeholder="Enter an existing connection ID"
            />
          </label>

          {/* Query Type */}
          <label>
            Query Type

            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setPreview(null);
                setError('');
                setSuccess('');
              }}
            >
              <option value="odata">
                SAP Business One Service Layer (OData)
              </option>

              <option value="sql">
                SQL Server / SAP HANA
              </option>
            </select>
          </label>

          {/* OData Configuration */}
          {kind === 'odata' && (
            <>
              <label>
                Service Layer Entity

                <select
                  value={entity}
                  onChange={(e) => setEntity(e.target.value)}
                >
                  <option value="Invoices">Invoices</option>
                  <option value="PurchaseOrders">PurchaseOrders</option>
                  <option value="Items">Items</option>
                </select>
              </label>

              <label>
                $select

                <input
                  type="text"
                  value={select}
                  onChange={(e) => setSelect(e.target.value)}
                  placeholder="DocNum,CardName"
                />
              </label>

              <label className="full-width">
                $filter

                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="DocStatus eq 'O'"
                />
              </label>
            </>
          )}

          {/* SQL Configuration */}
          {kind === 'sql' && (
            <label className="full-width">
              SQL Query

              <textarea
                rows="5"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="Enter an approved read-only SELECT query"
              />
            </label>
          )}

          {/* Row Limit */}
          <label>
            Row Limit

            <input
              type="number"
              min="1"
              max="1000"
              value={rowLimit}
              onChange={(e) => {
                const value = e.target.value;

                if (value === '') {
                  setRowLimit('');
                } else {
                  setRowLimit(
                    Math.min(1000, Math.max(1, Number(value)))
                  );
                }
              }}
            />
          </label>

        </div>

        <p className="field-note">
          Save your query before testing it. The preview displays
          a maximum of 10 rows. Enter an existing connection ID
          created through the team's Connection API.
        </p>

        {/* Success Message */}
        {success && (
          <div className="success-panel" role="status">
            {success}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="error-panel" role="alert">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="actions">

          <button
            className="secondary"
            type="button"
            onClick={saveQuery}
            disabled={saving || loading}
          >
            {saving ? 'Saving...' : 'Save Query'}
          </button>

          <button
            type="button"
            onClick={testQuery}
            disabled={loading || saving}
          >
            {loading ? 'Testing...' : 'Test Query'}
          </button>

        </div>

      </section>

      {/* Query Preview Results */}
      <QueryPreview
        result={preview}
        loading={loading}
        error={error}
      />

    </div>
  );
}
