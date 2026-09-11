/* 导出 PDF：走浏览器原生打印，文字可选可搜，不引入第三方库 */

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

export async function exportPdf(): Promise<void> {
  // 关键：字体没加载完就打印，PDF 里的中文会掉成兜底字体
  try {
    await document.fonts.ready;
  } catch {
    /* 浏览器不支持字体 API 时忽略 */
  }

  // 再等两帧，确保字体应用后的重排已经落到屏幕上
  await nextFrame();
  await nextFrame();

  window.print();
}
