/**
 * 字符串工具函数
 */

/**
 * 从歌曲名称中提取核心歌名。
 * 优先匹配中文书名号《》内的内容，否则返回原名称。
 * 例如：'翻唱《夜に駆ける》live' → '夜に駆ける'
 */
export const extractSongName = (name: string): string => {
  const source = String(name || '');
  const match = source.match(/《([^》]+)》/);
  if (match?.[1]) return match[1];
  return source;
};