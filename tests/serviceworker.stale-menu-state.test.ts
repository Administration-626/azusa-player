import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createChromeMock } from './helpers/chrome-mock';

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const createFavRecord = (id: string, title: string, songList: any[] = []) => ({
  info: { id, title },
  songList,
});

describe('service worker stale menu fallback', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('falls back to storage when in-memory menu state is stale after playlist changes', async () => {
    const favId = 'FavList-New';
    const { chromeMock, localStore, emitRuntimeMessage, emitContextMenuClick } = createChromeMock({
      MyFavList: [favId],
      [favId]: createFavRecord(favId, '新歌单'),
    });
    (globalThis as any).chrome = chromeMock;
    chromeMock.scripting.executeScript.mockResolvedValue([
      {
        result: [
          { id: '36507159061', bvid: 'BV1BQ4y1X714', name: 'Song', singer: 'Singer', cover: 'cover' },
        ],
      },
    ]);

    await import('../src/serviceworker/index.ts');
    await flushPromises();

    emitRuntimeMessage({
      type: 'fav-lists-change',
      data: [],
    });
    await flushPromises();

    emitContextMenuClick(
      {
        menuItemId: `page::${favId}`,
        pageUrl: 'https://www.bilibili.com/video/BV1BQ4y1X714',
      },
      { id: 10 },
    );
    await flushPromises();

    expect(localStore[favId].songList).toHaveLength(1);
    expect(chromeMock.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '已添加到歌单',
        message: expect.stringContaining('新歌单'),
      }),
    );
  });

  it('shows a no-op notice when all songs already exist in the target playlist', async () => {
    const favId = 'FavList-New';
    const existingSong = { id: '36507159061', bvid: 'BV1BQ4y1X714', name: 'Song', singer: 'Singer', cover: 'cover' };
    const { chromeMock, emitContextMenuClick } = createChromeMock({
      MyFavList: [favId],
      [favId]: createFavRecord(favId, '新歌单', [existingSong]),
    });
    (globalThis as any).chrome = chromeMock;
    chromeMock.scripting.executeScript.mockResolvedValue([{ result: [existingSong] }]);

    await import('../src/serviceworker/index.ts');
    await flushPromises();

    emitContextMenuClick(
      {
        menuItemId: `page::${favId}`,
        pageUrl: 'https://www.bilibili.com/video/BV1BQ4y1X714',
      },
      { id: 10 },
    );
    await flushPromises();

    expect(chromeMock.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '无需添加',
        message: expect.stringContaining('已经有'),
      }),
    );
  });

  it('shows the concrete error reason when add fails', async () => {
    const favId = 'FavList-New';
    const { chromeMock, emitContextMenuClick } = createChromeMock({
      MyFavList: [favId],
      [favId]: createFavRecord(favId, '新歌单'),
    });
    (globalThis as any).chrome = chromeMock;
    chromeMock.scripting.executeScript.mockRejectedValue(new Error('Bilibili API error -352'));

    await import('../src/serviceworker/index.ts');
    await flushPromises();

    emitContextMenuClick(
      {
        menuItemId: `page::${favId}`,
        pageUrl: 'https://www.bilibili.com/video/BV1BQ4y1X714',
      },
      { id: 10 },
    );
    await flushPromises();

    expect(chromeMock.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '添加失败',
        message: expect.stringContaining('Bilibili API error -352'),
      }),
    );
  });
});
