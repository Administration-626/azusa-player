/**
 * Bilibili 数据适配层（BilibiliApiClient）
 *
 * 深度 Adapter：将所有 Bilibili API 交互收敛到一个窄接口背后。
 * - 内部封装 URL 常量、分页合并、凭据策略、响应验证
 * - 外部暴露 fetchVideoInfo / fetchPlayUrl / fetchBvids / fetchCollection 等操作
 *
 * 使用方式：
 *   import { bilibiliApi } from '../api/bilibili/BilibiliApiClient';
 *   const video = await bilibiliApi.fetchVideoInfo('BV1xx...');
 *   const playUrl = await bilibiliApi.resolvePlayUrl('BV1xx', 'cid123');
 *
 * 认证策略：默认请求不带凭据（public API）；播放地址解析始终使用凭据。
 * 代理：web 模式下可通过 VITE_WEB_API_PROXY 配置转发。
 */

import VideoInfo from '../../objects/VideoInfo';
import { selectBestAudioUrl } from './PlayUrlPolicy';
import { browserApi } from '../../platform/browserApi';

// ── URL 常量 ──────────────────────────────────────────────
const URL_PLAY_URL = 'https://api.bilibili.com/x/player/playurl?cid={cid}&bvid={bvid}&qn=112&fnval=4048';
const URL_BVID_TO_CID = 'https://api.bilibili.com/x/player/pagelist?bvid={bvid}&jsonp=jsonp';
const URL_VIDEO_INFO = 'https://api.bilibili.com/x/web-interface/view?bvid={bvid}';
const URL_BILISERIES_INFO =
  'https://api.bilibili.com/x/series/archives?mid={mid}&series_id={sid}&only_normal=true&sort=desc&pn={pn}&ps=30';
const URL_BILICOLLE_INFO =
  'https://api.bilibili.com/x/polymer/web-space/seasons_archives_list?mid={mid}&season_id={sid}&sort_reverse=false&page_num={pn}&page_size=30';
const URL_FAV_LIST =
  'https://api.bilibili.com/x/v3/fav/resource/list?media_id={mid}&pn={pn}&ps=20&keyword=&order=mtime&type=0&tid=0&platform=web&jsonp=jsonp';

// ── 代理 ───────────────────────────────────────────────────
const WEB_API_PROXY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WEB_API_PROXY) || '';

// ── 类型 ───────────────────────────────────────────────────
interface VideoPage {
  cid: string;
  bvid: string;
  part: string;
}

interface VideoInfoLike {
  title: string;
  picSrc: string;
  uploader: { name: string; mid: string | number };
  pages: VideoPage[];
}

// ── Client ─────────────────────────────────────────────────
export class BilibiliApiClient {
  /**
   * @param credentials 全局默认凭据策略。为 true 时所有请求带上 cookies。
   *                    播放地址解析始终使用凭据，不受此选项影响。
   */
  constructor(private readonly options: { credentials?: boolean } = {}) {}

  // ══════════════════════════════════════════════════════════
  //  Public API
  // ══════════════════════════════════════════════════════════

  /** 获取视频元信息 */
  async fetchVideoInfo(bvid: string): Promise<VideoInfo | undefined> {
    try {
      const json = this.ensureBiliSuccess(await this.fetchBiliJson(URL_VIDEO_INFO.replace('{bvid}', bvid)));
      const data = json.data;
      return new VideoInfo(
        data.title,
        data.desc,
        data.videos,
        data.pic,
        data.owner,
        data.pages.map((s: any) => ({ bvid, part: s.part, cid: s.cid })),
      );
    } catch (error) {
      console.log('Some issue happened when fetching', bvid, error);
      return undefined;
    }
  }

  /** 获取视频的 CID（第一分 P） */
  async fetchCID(bvid: string): Promise<string | undefined> {
    try {
      const json = this.ensureBiliSuccess(await this.fetchBiliJson(URL_BVID_TO_CID.replace('{bvid}', bvid)));
      return json?.data?.[0]?.cid;
    } catch (error) {
      console.log(error);
      return undefined;
    }
  }

  /**
   * 纯网络请求解析播放地址（含 MCDN 过滤，不含缓存）。
   * @param bvid 视频 BVID
   * @param cid 视频 CID（若为空则自动通过 fetchCID 获取）
   */
  async resolvePlayUrl(bvid: string, cid?: string): Promise<string> {
    cid = await this.resolveCid(bvid, cid);
    if (!cid) return '';

    const json = await this.fetchBiliJsonWithCredentials(
      URL_PLAY_URL.replace('{bvid}', bvid).replace('{cid}', cid),
    );
    return this.extractAudioUrl(json);
  }

  /**
   * 带缓存的播放地址解析。
   * 先检查 chrome.storage 中当前正在播放的歌曲是否命中缓存，
   * 未命中则调用 resolvePlayUrl 从网络获取。
   */
  async resolvePlayUrlWithCache(bvid: string, cid?: string): Promise<string> {
    cid = await this.resolveCid(bvid, cid);
    if (!cid) return '';

    return new Promise<string>((resolve, reject) => {
      browserApi.storage.local.get(['CurrentPlaying', 'PlayerSetting'], (result: any) => {
        const currentPlaying = result?.CurrentPlaying;
        const playMode = result?.PlayerSetting?.playMode;
        if (currentPlaying && currentPlaying.cid == cid && playMode !== 'singleLoop' && currentPlaying.playUrl) {
          resolve(currentPlaying.playUrl);
          return;
        }

        this.resolvePlayUrl(bvid, cid).then(resolve).catch(reject);
      });
    });
  }

  /** 获取收藏夹中所有视频的 BVID 列表 */
  async fetchFavBvids(mid: string): Promise<string[]> {
    const firstJson = this.ensureBiliSuccess(await this.fetchFavPage(mid, 1));
    const data = firstJson.data;

    const mediaCount = data.info.media_count;
    const totalPages = Math.ceil(mediaCount / 20);
    const pagePromises: Promise<any>[] = [];

    for (let page = 2; page <= totalPages; page++) {
      pagePromises.push(this.fetchFavPage(mid, page));
    }

    const pages = (await Promise.all(pagePromises)).map(this.ensureBiliSuccess);
    return [
      ...(data.medias || []).map((m: any) => String(m?.bvid || '')).filter(Boolean),
      ...pages.flatMap((pageJson) =>
        (pageJson?.data?.medias || []).map((m: any) => String(m?.bvid || '')).filter(Boolean),
      ),
    ];
  }

  /** 获取 series 中所有视频的 BVID 列表 */
  async fetchBiliSeriesBvids(mid: string, sid: string): Promise<string[]> {
    const json = this.ensureBiliSuccess(
      await this.fetchBiliJson(URL_BILISERIES_INFO.replace('{mid}', mid).replace('{sid}', sid).replace('{pn}', '0')),
    );
    return (json?.data?.archives || []).map((v: any) => String(v?.bvid || '')).filter(Boolean);
  }

  /** 获取合集（season）中所有视频的 BVID 列表 */
  async fetchBiliColleBvids(mid: string, sid: string, favList: string[] = []): Promise<string[]> {
    const firstPageUrl = URL_BILICOLLE_INFO.replace('{mid}', mid).replace('{sid}', sid).replace('{pn}', '1');
    const json = this.ensureBiliSuccess(await this.fetchBiliJson(firstPageUrl));
    const data = json.data;

    const mediaCount = data.meta.total;
    const totalPages = 1 + Math.floor(mediaCount / data.page.page_size);
    const favSet = new Set(favList.map((item) => String(item || '')));

    const pagePromises = [Promise.resolve(json)];
    for (let page = 2; page <= totalPages; page++) {
      pagePromises.push(
        this.fetchBiliJson(URL_BILICOLLE_INFO.replace('{mid}', mid).replace('{sid}', sid).replace('{pn}', String(page))),
      );
    }

    const pages = (await Promise.all(pagePromises)).map(this.ensureBiliSuccess);
    return pages.flatMap((pageJson) =>
      (pageJson?.data?.archives || [])
        .map((m: any) => String(m?.bvid || ''))
        .filter((bvid: string) => bvid && !favSet.has(bvid)),
    );
  }

  /** 获取收藏夹中所有视频的 VideoInfo */
  async fetchFavList(mid: string): Promise<(VideoInfo | undefined)[]> {
    const bvids = await this.fetchFavBvids(mid);
    return Promise.all(bvids.map((bvid) => this.fetchVideoInfo(bvid)));
  }

  /** 获取 series 中所有视频的 VideoInfo */
  async fetchBiliSeriesInfo(mid: string, sid: string): Promise<(VideoInfo | undefined)[]> {
    const bvids = await this.fetchBiliSeriesBvids(mid, sid);
    return Promise.all(bvids.map((bvid) => this.fetchVideoInfo(bvid)));
  }

  /** 获取合集（season）中所有视频的 VideoInfo */
  async fetchBiliColleList(mid: string, sid: string, favList: string[] = []): Promise<(VideoInfo | undefined)[]> {
    const bvids = await this.fetchBiliColleBvids(mid, sid, favList);
    return Promise.all(bvids.map((bvid) => this.fetchVideoInfo(bvid)));
  }

  // ══════════════════════════════════════════════════════════
  //  Private helpers
  // ══════════════════════════════════════════════════════════

  /** 解析视频 CID：外部未提供时通过 fetchCID 获取 */
  private async resolveCid(bvid: string, cid?: string): Promise<string | undefined> {
    if (!cid) {
      cid = await this.fetchCID(bvid);
    }
    return cid;
  }

  private buildRequestUrl(url: string): string {
    if (!WEB_API_PROXY) return url;
    try {
      const proxyUrl = new URL(WEB_API_PROXY, window.location.origin);
      proxyUrl.searchParams.set('url', url);
      return proxyUrl.toString();
    } catch {
      return url;
    }
  }

  private async fetchJson(url: string, init: RequestInit = {}, includeCredentials = false): Promise<any> {
    const response = await fetch(this.buildRequestUrl(url), {
      ...init,
      ...(includeCredentials ? { credentials: 'include' as RequestCredentials } : {}),
      headers: {
        Accept: 'application/json, text/plain, */*',
        ...(init.headers || {}),
      },
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const preview = (await response.text()).slice(0, 160);
      throw new Error(`Bilibili API did not return JSON. content-type=${contentType || 'unknown'}, preview=${preview}`);
    }

    return response.json();
  }

  private async fetchBiliJson(url: string): Promise<any> {
    return this.fetchJson(url, {}, this.options.credentials ?? false);
  }

  private async fetchBiliJsonWithCredentials(url: string): Promise<any> {
    return this.fetchJson(url, {}, true);
  }

  private ensureBiliSuccess(json: any): any {
    if (typeof json?.code === 'number' && json.code !== 0) {
      throw new Error(json.message || json.msg || `Bilibili API error ${json.code}`);
    }
    return json;
  }

  /** 收藏夹分页请求：先尝试无凭据，失败后重试带凭据 */
  private async fetchFavPage(mid: string, page: number): Promise<any> {
    const url = URL_FAV_LIST.replace('{mid}', mid).replace('{pn}', String(page));
    try {
      return await this.fetchBiliJson(url);
    } catch (error) {
      console.log('fetchFavPage public request failed, retry with credentials', mid, page, error);
      return this.fetchBiliJsonWithCredentials(url);
    }
  }

  private extractAudioUrl(json: any): string {
    const audios = json?.data?.dash?.audio || [];
    return selectBestAudioUrl(audios);
  }
}

// ── 模块级单例 ──────────────────────────────────────────────
export const bilibiliApi = new BilibiliApiClient();