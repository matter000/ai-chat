import { toPng } from 'html-to-image';

export async function exportElementAsPng(el: HTMLElement, filename: string) {
  try {
    const dataUrl = await toPng(el, {
      backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff',
      pixelRatio: 2,
      cacheBust: true,
    });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  } catch (e) {
    console.error('exportElementAsPng failed', e);
    throw e;
  }
}
