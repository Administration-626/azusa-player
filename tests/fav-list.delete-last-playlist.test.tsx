/** @vitest-environment jsdom */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  Fav: ({ FavList }: any) => <div data-testid='mock-fav'>{FavList.info.title}</div>,
}));

vi.mock('../src/components/AddFavDialog', () => ({
  AddFavDialog: () => null,
  NewFavDialog: () => null,
  HelpDialog: () => null,
}));

vi.mock('../src/components/ConfirmDialog', () => ({
  AlertDialog: ({ openState, onClose, value }: any) =>
    openState ? (
      <button type='button' onClick={() => onClose(value)}>
        确认删除歌单吗？
      </button>
    ) : null,
}));

describe('FavList delete last playlist guard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('blocks deleting the final playlist and shows a warning notice', async () => {
    const user = userEvent.setup();
    const { chromeMock } = createChromeMock();
    (globalThis as any).chrome = chromeMock;

    const initialFav = {
      info: { id: 'FavList-1', title: '唯一歌单', currentTableInfo: {} },
      songList: [{ id: 's1', name: '旧歌', singer: 'A', bvid: 'BV_OLD' }],
    };

    const fakeStorage = {
      latestFavLists: [initialFav],
      setFavLists: undefined as any,
      initFavLists: vi.fn().mockImplementation(function (this: any) {
        this.setFavLists?.([...this.latestFavLists]);
        return Promise.resolve();
      }),
      readLocalStorage: vi.fn(),
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

    expect(await screen.findByTestId('mock-fav')).toHaveTextContent('唯一歌单');

    const deleteIcons = document.querySelectorAll('[data-testid="DeleteOutlineOutlinedIcon"]');
    expect(deleteIcons).toHaveLength(1);
    await user.click(deleteIcons[0] as Element);
    await user.click(screen.getByRole('button', { name: '确认删除歌单吗？' }));

    await waitFor(() => {
      expect(screen.getByText('至少保留一个歌单，不能删除最后一个歌单。')).toBeInTheDocument();
    });

    expect(fakeStorage.deleteFavList).not.toHaveBeenCalled();
  });

  it('shows a warning when there is no other playlist available as an add target', async () => {
    const user = userEvent.setup();
    const { chromeMock } = createChromeMock();
    (globalThis as any).chrome = chromeMock;

    const initialFav = {
      info: { id: 'FavList-1', title: '唯一歌单', currentTableInfo: {} },
      songList: [{ id: 's1', name: '旧歌', singer: 'A', bvid: 'BV_OLD' }],
    };

    const fakeStorage = {
      latestFavLists: [initialFav],
      setFavLists: undefined as any,
      initFavLists: vi.fn().mockImplementation(function (this: any) {
        this.setFavLists?.([...this.latestFavLists]);
        return Promise.resolve();
      }),
      readLocalStorage: vi.fn(),
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

    expect(await screen.findByTestId('mock-fav')).toHaveTextContent('唯一歌单');

    const addIcons = document.querySelectorAll('[data-testid="AddBoxOutlinedIcon"]');
    expect(addIcons.length).toBeGreaterThan(0);
    await user.click(addIcons[0] as Element);

    await waitFor(() => {
      expect(screen.getByText('当前没有可添加的目标歌单，请先新建另一个歌单。')).toBeInTheDocument();
    });
  });
};
