const escapeCsv = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const downloadCsv = ({ filename, headers, rows }) => {
  const safeFilename = (filename || 'export').endsWith('.csv') ? filename : `${filename || 'export'}.csv`;
  const csvLines = [
    headers.map(h => escapeCsv(h.label)).join(','),
    ...rows.map(row => headers.map(h => escapeCsv(row[h.key])).join(',')),
  ];

  const csvContent = csvLines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', safeFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
