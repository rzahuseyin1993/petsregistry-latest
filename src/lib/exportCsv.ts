export const exportToCsv = (filename: string, rows: Record<string, any>[], columns?: { key: string; label: string }[]) => {
  if (rows.length === 0) return;

  const cols = columns || Object.keys(rows[0]).map(key => ({ key, label: key }));

  const escapeCell = (val: any): string => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = cols.map(c => escapeCell(c.label)).join(",");
  const body = rows.map(row =>
    cols.map(c => escapeCell(row[c.key])).join(",")
  ).join("\n");

  const csv = header + "\n" + body;
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};
