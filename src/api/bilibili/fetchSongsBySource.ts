/**
 * 自包含的 Bilibili 歌曲抓取策略。
 *
 * 设计为通过 chrome.scripting.executeScript 在页面 MAIN 上下文执行，
 * 因此必须自包含（无 import、无扩展 API 调用）。
 *
 * 与 BilibiliApiClient 的区别：
 * - BilibiliApiClient 是深度 Adapter，返回 VideoInfo，可注入测试
 * - 本函数是轻量自包含版本，返回原始 Song 对象，专为页面上下文设计
 */

const URL_VIDEO_INFO = 'https://api.bilibili.com/x/web-interface/view?bvid={bvid}';
const URL_BILISERIES_INFO =
  'https://api.bilibili.com/x/series/archives?mid={mid}&series_id={sid}&only_normal=true&sort=desc&pn={pn}&ps=30';
const URL_BILICOLLE_INFO =
  'https://api.bilibili.com/x/polymer/web-space/seasons_archives_list?mid={mid}&season_id={sid}&sort_reverse=false&page_num={pn}&page_size=30';
const URL_FAV_LIST =
  'https://api.bilibili.com/x/v3/fav/resource/list?media_id={mid}&pn={pn}&ps=20&keyword=&order=mtime&type=0&tid=0&platform=web&jsonp=jsonp';

type PageSource = { type: string; bvid?: string; mid?: string; sid?: string };

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url, {
    credentials: 'include',
    headers: { Accept: 'application/json, text/plain, */*' },
  });
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  if (!contentType.includes('application/json')) {
    throw new Error(`Expected JSON from ${url}, received ${contentType || 'unknown'}: ${text.slice(0, 120)}`);
  }
  const json = JSON.parse(text);
  if (typeof json?.code === 'number' && json.code !== 0) {
    throw new Error(json.message || json.msg || `Bilibili API error ${json.code}`);
  }
  return json;
}

function toSongs(data: any, bvid: string): any[] {
  const pages = Array.isArray(data?.pages) ? data.pages : [];
  const baseSong = {
    bvid,
    singer: String(data?.owner?.name || ''),
    singerId: data?.owner?.mid ?? '',
    cover: String(data?.pic || ''),
    lyric: '',
    lyricOffset: 0,
  };
  if (pages.length <= 1) {
    const cid = String(pages[0]?.cid || data?.cid || '');
    if (!cid) return [];
    return [{ ...baseSong, id: cid, name: String(data?.title || bvid) }];
  }
  return pages
    .map((page: any) => {
      const cid = String(page?.cid || '');
      if (!cid) return null;
      return { ...baseSong, id: cid, name: String(page?.part || data?.title || bvid) };
    })
    .filter(Boolean);
}

async function fetchVideoSongs(bvid: string): Promise<any[]> {
  const json = await fetchJson(URL_VIDEO_INFO.replace('{bvid}', bvid));
  return toSongs(json?.data, bvid);
}

async function fetchSongsByBvids(bvids: string[]): Promise<any[]> {
  const uniqueBvids = Array.from(new Set(bvids.filter(Boolean)));
  const songGroups = await Promise.all(uniqueBvids.map((bvid) => fetchVideoSongs(bvid)));
  return songGroups.flat();
}

export async function fetchSongsBySource(source: PageSource): Promise<any[]> {
  if (source.type === 'bvid') {
    return fetchVideoSongs(source.bvid!);
  }

  if (source.type === 'fav') {
    const firstPage = await fetchJson(URL_FAV_LIST.replace('{mid}', source.mid!).replace('{pn}', '1'));
    const mediaCount = Number(firstPage?.data?.info?.media_count || 0);
    const totalPages = Math.max(1, Math.ceil(mediaCount / 20));
    const pageRequests = [Promise.resolve(firstPage)];
    for (let page = 2; page <= totalPages; page += 1) {
      pageRequests.push(fetchJson(URL_FAV_LIST.replace('{mid}', source.mid!).replace('{pn}', String(page))));
    }
    const pages = await Promise.all(pageRequests);
    const bvids = pages.flatMap((pageJson: any) =>
      (pageJson?.data?.medias || []).map((media: any) => String(media?.bvid || '')).filter(Boolean),
    );
    return fetchSongsByBvids(bvids);
  }

  if (source.type === 'series') {
    const firstPage = await fetchJson(
      URL_BILISERIES_INFO.replace('{mid}', source.mid!).replace('{sid}', source.sid!).replace('{pn}', '1'),
    );
    const bvids = (firstPage?.data?.archives || []).map((item: any) => String(item?.bvid || '')).filter(Boolean);
    return fetchSongsByBvids(bvids);
  }

  if (source.type === 'collection') {
    const firstPage = await fetchJson(
      URL_BILICOLLE_INFO.replace('{mid}', source.mid!).replace('{sid}', source.sid!).replace('{pn}', '1'),
    );
    const totalCount = Number(firstPage?.data?.meta?.total || 0);
    const pageSize = Number(firstPage?.data?.page?.page_size || 30);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const pageRequests = [Promise.resolve(firstPage)];
    for (let page = 2; page <= totalPages; page += 1) {
      pageRequests.push(
        fetchJson(URL_BILICOLLE_INFO.replace('{mid}', source.mid!).replace('{sid}', source.sid!).replace('{pn}', String(page))),
      );
    }
    const pages = await Promise.all(pageRequests);
    const bvids = pages.flatMap((pageJson: any) =>
      (pageJson?.data?.archives || []).map((item: any) => String(item?.bvid || '')).filter(Boolean),
    );
    return fetchSongsByBvids(bvids);
  }

  return [];
}