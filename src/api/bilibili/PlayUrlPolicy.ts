/**
 * 播放地址选择策略（PlayUrlPolicy）
 *
 * 从 B 站 playurl 接口返回的 dash 音频列表中，选择一个最适合播放的 URL。
 * 纯函数模块：不依赖 fetch / chrome / window，可独立单元测试。
 *
 * B 站 MCDN (Peer-to-Peer) 节点在扩展程序和代理环境下极不稳定，
 * 经常返回 404 或被拦截。策略优先选择官方标准的 CDN 链接以确保播放成功率，
 * 即使这意味着可能会略微降低码率。
 */

export interface AudioTrack {
  id?: number;
  bandwidth?: number;
  codecs?: string;
  baseUrl?: string;
  base_url?: string;
  backupUrl?: string[];
  backup_url?: string[];
}

const isMcdnUrl = (url: string): boolean => String(url || '').includes('mcdn.bilivideo.cn');

/**
 * 从 dash 音频列表中选出最佳播放地址。
 *
 * 规则：
 * 1. 按带宽（质量）降序排序
 * 2. 遍历音轨，寻找第一个包含非 MCDN 稳定链接的音轨
 * 3. 若全部音轨都是 MCDN，则保底选择质量最高音轨的首选链接
 *
 * @returns 选中的播放地址；无可用音轨时返回空字符串
 */
export const selectBestAudioUrl = (audioTracks: AudioTrack[] = []): string => {
  const audios = audioTracks || [];
  if (audios.length === 0) return '';

  const ordered = [...audios].sort((a, b) => {
    const aScore = Number(a?.bandwidth || a?.id || 0);
    const bScore = Number(b?.bandwidth || b?.id || 0);
    return bScore - aScore;
  });

  for (const audio of ordered) {
    const urls = [
      audio?.baseUrl || audio?.base_url,
      ...(audio?.backupUrl || audio?.backup_url || []),
    ].filter(Boolean) as string[];

    const stableUrl = urls.find((url) => !isMcdnUrl(url));
    if (stableUrl) {
      return stableUrl;
    }
  }

  const topAudio = ordered[0];
  return topAudio?.baseUrl || topAudio?.base_url || '';
};