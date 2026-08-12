import { describe, expect, it } from 'vitest';
import { parseSearchSource } from '../src/utils/searchSource';

describe('search source parsing', () => {
  it('parses bilibili video pages by BVID', () => {
    expect(parseSearchSource('https://www.bilibili.com/video/BV1BQ4y1X714')).toEqual({
      type: 'bvid',
      bvid: 'BV1BQ4y1X714',
    });
  });

  it('parses favorite, series, and collection sources from supported URLs', () => {
    expect(parseSearchSource('https://space.bilibili.com/123456/favlist?fid=1042352181')).toEqual({
      type: 'fav',
      mid: '1042352181',
    });

    expect(parseSearchSource('https://space.bilibili.com/444180997/lists/828030?type=series')).toEqual({
      type: 'series',
      mid: '444180997',
      sid: '828030',
    });

    expect(parseSearchSource('https://space.bilibili.com/5109111/lists/6995126?type=season')).toEqual({
      type: 'collection',
      mid: '5109111',
      sid: '6995126',
    });
  });

  it('parses channel detail pages for series and collection sources', () => {
    expect(parseSearchSource('https://space.bilibili.com/444180997/channel/seriesdetail?sid=828030')).toEqual({
      type: 'series',
      mid: '444180997',
      sid: '828030',
    });

    expect(parseSearchSource('https://space.bilibili.com/5109111/channel/collectiondetail?sid=6995126')).toEqual({
      type: 'collection',
      mid: '5109111',
      sid: '6995126',
    });
  });
});

describe('fetchSongsBySource chunked execution and fault tolerance', () => {
  it('fetches songs in chunks and isolates individual video fetch failures', async () => {
    const { fetchSongsBySource } = await import('../src/api/bilibili/fetchSongsBySource');
    const originalFetch = globalThis.fetch;

    let activeRequests = 0;
    let maxConcurrentRequests = 0;

    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = String(url);
      activeRequests += 1;
      maxConcurrentRequests = Math.max(maxConcurrentRequests, activeRequests);

      // 稍微模拟异步 IO 延迟以精确捕捉最大并发数
      await new Promise((res) => setTimeout(res, 10));
      activeRequests -= 1;

      if (urlStr.includes('/fav/resource/list')) {
        return {
          headers: new Headers({ 'content-type': 'application/json' }),
          text: async () =>
            JSON.stringify({
              code: 0,
              data: {
                info: { media_count: 12 },
                medias: Array.from({ length: 12 }, (_, i) => ({ bvid: `BV1test${i}` })),
              },
            }),
        } as Response;
      }

      if (urlStr.includes('/web-interface/view?bvid=BV1test3')) {
        // 模拟第 4 个视频触发 HTTP 412/429 异常
        return {
          headers: new Headers({ 'content-type': 'application/json' }),
          text: async () => JSON.stringify({ code: -412, message: 'Request frequency limit' }),
        } as Response;
      }

      const match = urlStr.match(/bvid=(BV1test\d+)/);
      const bvid = match ? match[1] : 'BV1test';

      return {
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () =>
          JSON.stringify({
            code: 0,
            data: {
              title: `Song ${bvid}`,
              owner: { name: 'UP Owner', mid: 1001 },
              pic: 'cover.jpg',
              pages: [{ cid: 100 + Number(bvid.slice(7) || 0), part: `Part ${bvid}` }],
            },
          }),
      } as Response;
    };

    try {
      const songs = await fetchSongsBySource({ type: 'fav', mid: '1042352181' });

      // 12 个视频除以 1 个异常，剩余 11 个成功返回
      expect(songs).toHaveLength(11);

      // 并发度被限制在 chunkSize = 5 内，而不是瞬间发 12 个
      expect(maxConcurrentRequests).toBeLessThanOrEqual(5);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

