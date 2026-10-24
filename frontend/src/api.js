export async function api(path, options = {}) {
  const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({ message: 'The server returned an unexpected response' }));
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('session-expired'));
    throw new Error(data.message || 'Request failed');
  }
  return data;
}

export function exportCsv(filename, columns, rows) {
  const cell = value => {
    let str = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
    return `"${str.replaceAll('"', '""')}"`;
  };
  const csv = [columns, ...rows].map(row => row.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
