'use client';

import React from 'react';
import { useOffline } from '@/context/OfflineContext';
import { formatRWFFull } from '@/lib/format';

/** Visits saved on this phone that the server has not received yet. */
export default function PendingVisitsPanel() {
  const { queued, online, syncing, needsSignIn, syncNow, discard, retry } = useOffline();
  if (queued.length === 0) return null;
  const waiting = queued.filter((v) => v.status === 'waiting').length;

  return (
    <section className="no-print">
      <table className="w-full text-sm">
        <caption className="pb-1 text-left">
          <strong>Saved on this phone, not yet sent ({queued.length})</strong>
          {waiting > 0 && online && !needsSignIn && (
            <>
              {' '}
              <button type="button" onClick={syncNow} disabled={syncing} className="text-link underline">
                {syncing ? 'Sending...' : 'Send now'}
              </button>
            </>
          )}
          <span className="block text-xs text-muted-foreground">
            Prices and credit limits are checked when a visit is sent, so an order total or credit hold may differ from
            what the phone showed.
          </span>
        </caption>
        <thead>
          <tr>
            <th className="px-2 py-1 text-left">Entered</th>
            <th className="px-2 py-1 text-left">Visit date</th>
            <th className="px-2 py-1 text-left">Customer</th>
            <th className="px-2 py-1 text-left">Outcome</th>
            <th className="px-2 py-1 text-right">Order (est.)</th>
            <th className="px-2 py-1 text-left">Status</th>
            <th className="px-2 py-1" />
          </tr>
        </thead>
        <tbody>
          {queued.map((v) => (
            <tr key={v.clientRef}>
              <td className="px-2 py-1 whitespace-nowrap">
                {new Date(v.capturedAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
              </td>
              <td className="px-2 py-1">{v.label.dateOfVisit}</td>
              <td className="px-2 py-1">{v.label.customerName}</td>
              <td className="px-2 py-1">{v.label.visitOutcome}</td>
              <td className="px-2 py-1 text-right font-tabular">
                {v.label.lineCount ? `${formatRWFFull(v.label.estimatedTotal)} (${v.label.lineCount} item${v.label.lineCount === 1 ? '' : 's'})` : '—'}
              </td>
              <td className="px-2 py-1">
                {v.status === 'waiting' ? (
                  'Waiting'
                ) : (
                  <span className="text-negative">
                    <strong>Not accepted:</strong> {v.error}
                  </span>
                )}
              </td>
              <td className="px-2 py-1 whitespace-nowrap">
                {v.status === 'rejected' && (
                  <>
                    <button type="button" onClick={() => retry(v.clientRef)} className="text-link underline">
                      Try again
                    </button>{' '}
                  </>
                )}
                <button
                  type="button"
                  onClick={() =>
                    window.confirm(`Delete the visit to ${v.label.customerName} from this phone? It has not been sent.`) &&
                    discard(v.clientRef)
                  }
                  className="text-link underline"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
