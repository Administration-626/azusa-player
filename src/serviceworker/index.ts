import { getSongsFromSource, type SearchSource } from '../background/DataProcess';
import { parseSearchSource, type ContextTargetPayload } from '../utils/searchSource';
import { fetchSongsBySource } from '../api/bilibili/fetchSongsBySource';

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

const MY_FAV_LIST_KEY = 'MyFavList';
const LINK_MENU_ID = 'AddToPlayListLink';
const PAGE_MENU_ID = 'AddToPlayListPage';
const ELEMENT_MENU_ID = 'AddToPlayListElement';
const EMPTY_LINK_MENU_ID = 'NoFavListLink';
const EMPTY_PAGE_MENU_ID = 'NoFavListPage';
const EMPTY_ELEMENT_MENU_ID = 'NoFavListElement';

const SUPPORTED_LINK_PATTERNS = [
  'https://*.bilibili.com/video/*',
  'https://www.bilibili.com/video/*',
  'https://space.bilibili.com/*/favlist*',
  'https://space.bilibili.com/*/lists/*',
  'https://space.bilibili.com/*/channel/seriesdetail*',
  'https://space.bilibili.com/*/channel/collectiondetail*',
];

const SUPPORTED_PAGE_PATTERNS = [
  'https://*.bilibili.com/video/*',
  'https://www.bilibili.com/video/*',
  'https://space.bilibili.com/*/favlist*',
  'https://space.bilibili.com/*/lists/*',
  'https://space.bilibili.com/*/channel/seriesdetail*',
  'https://space.bilibili.com/*/channel/collectiondetail*',
];

type FavInfo = {
  id: string;
  title: string;
};

let latestFavMenuInfos: FavInfo[] = [];
let isRenderingMenus = false;
let shouldRenderMenusAgain = false;
const specialContextByTabId = new Map<number, SearchSource>();
const contextMenusApi = chrome.contextMenus as typeof chrome.contextMenus & {
  onShown?: {
    addListener: (listener: (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => void) => void;
  };
  onHidden?: {
    addListener: (listener: () => void) => void;
  };
  refresh?: () => void;
};

const isFavInfo = (value: unknown): value is FavInfo => {
  const candidate = value as FavInfo | undefined;
  return !!candidate?.id && !!candidate?.title;
};

const describeSource = (source: SearchSource) => {
  switch (source.type) {
    case 'bvid':
      return source.bvid;
    case 'fav':
      return `收藏夹 ${source.mid}`;
    case 'series':
      return `series ${source.sid}`;
    case 'collection':
      return `season ${source.sid}`;
    default:
      return '来源链接';
  }
};

const getFavInfoFromStorage = async (favId: string): Promise<FavInfo | null> => {
  try {
    const result = await getFromLocalStorage([favId]);
    const info = result?.[favId]?.info;
    return isFavInfo(info) ? info : null;
  } catch {
    return null;
  }
};

const sendFavUpdate = (favId: string, count: number) => {
  chrome.runtime.sendMessage(
    {
      type: 'fav-update',
      data: { favId, count, fav_id: favId, n: count },
    },
    () => {
      chrome.runtime.lastError;
    },
  );
};

const notify = (title: string, message: string, isError = false, tabId?: number) => {
  const fallbackToSystem = () => {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title,
      message,
    });
  };

  if (typeof tabId === 'number') {
    chrome.scripting
      .executeScript({
        target: { tabId },
        func: (t: string, m: string, e: boolean) => {
          const container = document.createElement('div');
          Object.assign(container.style, {
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: e ? '#fdecea' : '#eafaf1',
            color: e ? '#d32f2f' : '#2e7d32',
            border: `1px solid ${e ? '#f5c2c7' : '#badbcc'}`,
            padding: '16px 20px',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: '2147483647',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '14px',
            lineHeight: '1.5',
            transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            opacity: '0',
            transform: 'translateY(10px)',
            maxWidth: '360px',
            pointerEvents: 'none',
          });

          const titleEl = document.createElement('div');
          titleEl.style.fontWeight = '600';
          titleEl.style.marginBottom = '6px';
          titleEl.style.fontSize = '15px';
          titleEl.textContent = t;

          const msgEl = document.createElement('div');
          msgEl.style.opacity = '0.9';
          msgEl.textContent = m;

          container.appendChild(titleEl);
          container.appendChild(msgEl);
          document.documentElement.appendChild(container);

          requestAnimationFrame(() => {
            container.style.opacity = '1';
            container.style.transform = 'translateY(0)';
          });

          setTimeout(() => {
            container.style.opacity = '0';
            container.style.transform = 'translateY(10px)';
            setTimeout(() => {
              if (container.parentNode) container.parentNode.removeChild(container);
            }, 300);
          }, 3500);
        },
        args: [title, message, isError],
      })
      .catch(() => fallbackToSystem());
  } else {
    fallbackToSystem();
  }
};

const describeError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || '');
  if (!message) return '未知错误';
  if (message.length <= 120) return message;
  return `${message.slice(0, 117)}...`;
};

const removeAllMenus = () =>
  new Promise<void>((resolve) => {
    chrome.contextMenus.removeAll(() => {
      chrome.runtime.lastError;
      resolve();
    });
  });

const createMenuItem = (createProperties: chrome.contextMenus.CreateProperties) =>
  new Promise<void>((resolve) => {
    chrome.contextMenus.create(createProperties, () => {
      const errorMessage = chrome.runtime.lastError?.message;
      if (errorMessage && !errorMessage.includes('duplicate id')) {
        console.warn('[azusa-player][context-menu] create failed', errorMessage, createProperties.id);
      }
      resolve();
    });
  });

const toLinkChildId = (favId: string) => `link::${favId}`;
const toPageChildId = (favId: string) => `page::${favId}`;
const toElementChildId = (favId: string) => `element::${favId}`;

const updateElementMenuVisibility = (visible: boolean) => {
  chrome.contextMenus.update(
    ELEMENT_MENU_ID,
    { visible },
    () => {
      chrome.runtime.lastError;
      contextMenusApi.refresh?.();
    },
  );
};

const renderMenuItems = async (favListsInfo: FavInfo[]) => {
  await removeAllMenus();

  await createMenuItem({
    id: LINK_MENU_ID,
    title: '添加到歌单',
    contexts: ['link'],
    targetUrlPatterns: SUPPORTED_LINK_PATTERNS,
  });

  await createMenuItem({
    id: PAGE_MENU_ID,
    title: '添加到歌单',
    contexts: ['page'],
    documentUrlPatterns: SUPPORTED_PAGE_PATTERNS,
  });

  await createMenuItem({
    id: ELEMENT_MENU_ID,
    title: '添加到歌单',
    contexts: ['all'],
    documentUrlPatterns: SUPPORTED_PAGE_PATTERNS,
    visible: false,
  });

  await createMenuItem({ id: 'link::new_fav', parentId: LINK_MENU_ID, title: '➕ 作为新歌单收藏', contexts: ['link'] });
  await createMenuItem({ id: 'page::new_fav', parentId: PAGE_MENU_ID, title: '➕ 作为新歌单收藏', contexts: ['page'] });
  await createMenuItem({ id: 'element::new_fav', parentId: ELEMENT_MENU_ID, title: '➕ 作为新歌单收藏', contexts: ['all'] });

  if (favListsInfo.length > 0) {
    await createMenuItem({ id: 'link::separator', parentId: LINK_MENU_ID, type: 'separator', contexts: ['link'] });
    await createMenuItem({ id: 'page::separator', parentId: PAGE_MENU_ID, type: 'separator', contexts: ['page'] });
    await createMenuItem({ id: 'element::separator', parentId: ELEMENT_MENU_ID, type: 'separator', contexts: ['all'] });

    for (const info of favListsInfo) {
      await createMenuItem({
        id: toLinkChildId(info.id),
        parentId: LINK_MENU_ID,
        title: info.title,
        contexts: ['link'],
      });

      await createMenuItem({
        id: toPageChildId(info.id),
        parentId: PAGE_MENU_ID,
        title: info.title,
        contexts: ['page'],
      });

      await createMenuItem({
        id: toElementChildId(info.id),
        parentId: ELEMENT_MENU_ID,
        title: info.title,
        contexts: ['all'],
      });
    }
  }
};

const requestMenuRender = (favListsInfo: FavInfo[]) => {
  latestFavMenuInfos = favListsInfo;
  if (isRenderingMenus) {
    shouldRenderMenusAgain = true;
    return;
  }

  void (async () => {
    isRenderingMenus = true;
    do {
      shouldRenderMenusAgain = false;
      await renderMenuItems(latestFavMenuInfos);
    } while (shouldRenderMenusAgain);
    isRenderingMenus = false;
  })();
};

let menuRenderTimer: ReturnType<typeof setTimeout> | null = null;
const debouncedRequestMenuRender = (favInfos: FavInfo[]) => {
  if (menuRenderTimer) clearTimeout(menuRenderTimer);
  menuRenderTimer = setTimeout(() => {
    menuRenderTimer = null;
    requestMenuRender(favInfos);
  }, 300);
};

const loadFavMenuInfos = () => {
  chrome.storage.local.get(MY_FAV_LIST_KEY, (result) => {
    const favListKeys: string[] = result[MY_FAV_LIST_KEY] || [];
    if (!favListKeys.length) {
      requestMenuRender([]);
      return;
    }

    chrome.storage.local.get(favListKeys, (listObj) => {
      const favInfos = favListKeys
        .map((id) => (listObj[id] as { info?: FavInfo } | undefined)?.info)
        .filter(isFavInfo);

      requestMenuRender(favInfos);
    });
  });
};

loadFavMenuInfos();

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'fav-lists-change') {
    debouncedRequestMenuRender(Array.isArray(message.data) ? message.data.filter(isFavInfo) : []);
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type !== 'context-target-change') return;

  const tabId = sender.tab?.id;
  if (typeof tabId !== 'number') return;

  const payload = (message.data || { source: null, targetType: 'none' }) as ContextTargetPayload;
  if (payload.targetType === 'non-link-item' && payload.source) {
    specialContextByTabId.set(tabId, payload.source);
  } else {
    specialContextByTabId.delete(tabId);
  }
});

contextMenusApi.onShown?.addListener((info, tab) => {
  const source = typeof tab?.id === 'number' ? specialContextByTabId.get(tab.id) : undefined;
  const shouldShow = !!source && !info.linkUrl;
  updateElementMenuVisibility(shouldShow);
});

contextMenusApi.onHidden?.addListener(() => {
  updateElementMenuVisibility(false);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (typeof info.menuItemId !== 'string') return;
  if (info.menuItemId === LINK_MENU_ID || info.menuItemId === PAGE_MENU_ID || info.menuItemId === ELEMENT_MENU_ID) return;

  const isLinkMenu = info.menuItemId.startsWith('link::');
  const isPageMenu = info.menuItemId.startsWith('page::');
  const isElementMenu = info.menuItemId.startsWith('element::');
  if (!isLinkMenu && !isPageMenu && !isElementMenu) return;

  const favId = info.menuItemId.slice(info.menuItemId.indexOf('::') + 2);
  void (async () => {
    const tabId = typeof tab?.id === 'number' ? tab.id : undefined;
    const source = isElementMenu
      ? (typeof tabId === 'number' ? specialContextByTabId.get(tabId) : undefined)
      : parseSearchSource(isLinkMenu ? info.linkUrl : info.pageUrl);
      
    if (!source) {
      notify('添加失败', '当前目标不是支持的 B 站视频 / 收藏夹 / 合集 / series / season。', true, tabId);
      return;
    }

    if (favId === 'new_fav') {
      try {
        const songs = await getSongsFromCurrentPage(source, tabId);
        if (!songs.length) {
          notify('创建失败', `未能从该来源获取到任何歌曲。`, true, tabId);
          return;
        }

        const title = songs.length === 1 ? songs[0].name : `${songs[0].name} 等`;
        const newFavId = `FavList-${crypto.randomUUID()}`;
        const newFav = {
          info: { title, id: newFavId },
          songList: songs,
        };

        const result = await getFromLocalStorage([MY_FAV_LIST_KEY]).catch(() => ({}));
        const favListKeys = result[MY_FAV_LIST_KEY] || [];
        favListKeys.unshift(newFavId); // prepend so it appears at top

        chrome.storage.local.set({ [MY_FAV_LIST_KEY]: favListKeys, [newFavId]: newFav }, () => {
          loadFavMenuInfos(); // Re-render menus immediately
          notify('已创建新歌单', `已创建歌单“${title}”并添加了 ${songs.length} 首歌曲`, false, tabId);
        });
      } catch (error) {
        console.error('[azusa-player][context-menu] create new fav failed', error);
        notify('创建失败', `无法创建新歌单：${describeError(error)}`, true, tabId);
      }
      return;
    }

    const favInfo = latestFavMenuInfos.find((v) => v.id === favId) || (await getFavInfoFromStorage(favId));
    if (!favInfo) {
      notify('添加失败', '目标歌单不存在，请刷新扩展后重试。', true, tabId);
      return;
    }

    addSourceToFav(source, favId, tabId)
      .then((count) => {
        if (count === 0) {
          notify('无需添加', `${favInfo.title} 里已经有 ${describeSource(source)} 的全部歌曲了。`, false, tabId);
          return;
        }
        sendFavUpdate(favId, count);
        notify('已添加到歌单', `已将 ${describeSource(source)} 的 ${count} 首歌曲添加到 ${favInfo.title}`, false, tabId);
      })
      .catch((error) => {
        console.error('[azusa-player][context-menu] add failed', error);
        notify('添加失败', `无法将 ${describeSource(source)} 添加到 ${favInfo.title}：${describeError(error)}`, true, tabId);
      });
  })();
});

async function addSourceToFav(source: SearchSource, favId: string, tabId?: number) {
  const songs = await getSongsFromCurrentPage(source, tabId);
  const fav = (await getFromLocalStorage([favId]))[favId];
  if (!fav?.songList) {
    throw new Error(`Fav list ${favId} is missing.`);
  }

  const filtered = songs.filter((song) => fav.songList.find((item: any) => item.id == song.id) === undefined);
  const newFav = { info: fav.info, songList: filtered.concat(fav.songList) };

  return new Promise<number>((resolve) => {
    chrome.storage.local.set({ [favId]: newFav }, () => {
      resolve(filtered.length);
    });
  });
}

async function getSongsFromCurrentPage(source: SearchSource, tabId?: number): Promise<any[]> {
  const fallbackFetch = () => getSongsFromSource(source);

  if (typeof tabId !== 'number') {
    return fallbackFetch();
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      args: [source],
      func: fetchSongsBySource,
    });

    const songs = results?.[0]?.result;
    if (Array.isArray(songs) && songs.length > 0) {
      return songs;
    }
    
    console.warn('[azusa-player] Page context returned invalid or empty songs, falling back...', results);
    return fallbackFetch();
  } catch (error) {
    console.warn('[azusa-player] page-context fetch failed, falling back...', error);
    return fallbackFetch();
  }
}


async function getFromLocalStorage(keys: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (Object.keys(result).length > 0) {
        resolve(result);
      } else {
        reject(new Error(`Storage key not found: ${keys.join(', ')}`));
      }
    });
  });
}

export {};
