/** @vitest-environment jsdom */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FavList } from '../src/components/FavList';
import { createChromeMock } from './helpers/chrome-mock';

vi.mock('../src/popup/App', async () => {
  const ReactModule = await import('react');
  return {
    __esModule: true,
    default: ReactModule.createContext<any>(null),
    App: () => null,
  };
});

// eslint-disable-next-line import/first
import StorageManagerCtx from '../src/popup/App';

vi.mock('../src/components/Search', () => ({
  Search: () => <div data-testid='mock-search' />,
}));

vi.mock('../src/components/Fav', () => ({
  Fav: ({ FavList }: any) => (
    <div data-testid='mock-fav' data-favid={FavList.info.id} data-songcount={FavList.songList.length}>
      {FavList.info.title}
    </div>
  ),
}));

vi.mock('../src/components/AddFavDialog', () => ({
  AddFavDialog: () => null,
  NewFavDialog: () => null,
  HelpDialog: () => null,
}));

describe('FavList runtime message regression', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('refreshes and selects the updated playlist when fav-update arrives', async () => {
    const { chromeMock, emitRuntimeMessage } = createChromeMock();
    (globalThis as any).chrome = chromeMock;

    const initialFav = {
      info: { id: 'FavList-1', title: '旧歌单', currentTableInfo: {} },
      songList: [{ id: 's1', name: '旧歌', singer: 'A', bvid: 'BV_OLD' }],
    };

    const updatedFav = {
      info: { id: 'FavList-1', title: '新歌单', currentTableInfo: {} },
      songList: [
        { id: 's2', name: '新歌 1', singer: 'B', bvid: 'BV_NEW_1' },
        { id: 's3', name: '新歌 2', singer: 'C', bvid: 'BV_NEW_2' },
      ],
    };

    const fakeStorage = {
      listeners: new Set<(lists: any[]) => void>(),
      subscribe: function (this: any, listener: any) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
      },
      latestFavLists: [initialFav],
      initFavLists: vi.fn().mockImplementation(function (this: any) {
        this.listeners.forEach((l: any) => l([...this.latestFavLists]));
        return Promise.resolve();
      }),
      syncFavFromStorage: vi.fn().mockImplementation(function (this: any, _favId: string, _count: number) {
        const merged = { ...this.latestFavLists[0], ...updatedFav };
        merged.songList = merged.songList || [];
        this.latestFavLists[0] = merged;
        this.listeners.forEach((l: any) => l([...this.latestFavLists]));
        return Promise.resolve(merged);
      }),
      getPlayerSetting: vi.fn().mockResolvedValue({ darkMode: false }),
      setPlayerSetting: vi.fn(),
      updateFavList: vi.fn(),
      exportStorage: vi.fn(),
      importStorage: vi.fn(),
      addFavList: vi.fn(),
      deleteFavList: vi.fn(),
    } as any;

    render(
      <StorageManagerCtx.Provider value={fakeStorage}>
        <FavList
          darkMode={false}
          onPlayOneFromFav={vi.fn()}
          onPlayAllFromFav={vi.fn()}
          onAddFavToList={vi.fn()}
          onAddOneFromFav={vi.fn()}
        />
      </StorageManagerCtx.Provider>,
    );

    expect(await screen.findByTestId('mock-fav')).toHaveTextContent('旧歌单');

    emitRuntimeMessage({
      type: 'fav-update',
      data: {
        favId: 'FavList-1',
        count: 1,
      },
    });

    await waitFor(() => {
      expect(fakeStorage.syncFavFromStorage).toHaveBeenCalledWith('FavList-1', 1);
      expect(screen.getByTestId('mock-fav')).toHaveTextContent('新歌单');
      expect(screen.getByTestId('mock-fav')).toHaveAttribute('data-songcount', '2');
    });

    expect(fakeStorage.setPlayerSetting).toHaveBeenCalledWith({ darkMode: false, selectedFavId: 'FavList-1' });
  });
});
