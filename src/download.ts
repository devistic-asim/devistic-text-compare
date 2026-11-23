export function downloadText(filename: string, contents: string, mime: string): void {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safe = filename.replaceAll(/[\\/:*?"<>|\r\n]+/g, '-').replaceAll(/\s+/g, ' ').trim();
  link.href = url;
  link.download = (safe || 'download').slice(0, 140);
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
