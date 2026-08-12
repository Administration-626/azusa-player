import { bilibiliApi } from '../api/bilibili/BilibiliApiClient';
import Song from '../objects/Song';
import { browserApi } from '../platform/browserApi';

const DEFAULT_BVID = 'BV1BQ4y1X714';
const LAST_PLAY_LIST = 'LastPlayList';

type VideoPage = { cid: string; bvid: string; part: string };
type VideoInfoLike = {
  title: string;
  picSrc: string;
  uploader: { name: string; mid: string | number };
  pages: VideoPage[];
};
type SongLike = { bvid?: string };
export type RefreshProgress = {
  processed: number;
  total: number;
  failedCount: number;
};
export type RefreshFromSourceResult = {
  songs: Song[];
  processed: number;
  total: number;
  failedCount: number;
  failedBvids: string[];
};

export type SearchSource =
  | { type: 'bvid'; bvid: string }
  | { type: 'fav'; mid: string }
  | { type: 'series'; mid: string; sid: string }
  | { type: 'collection'; mid: string; sid: string };

export const initSongList = async (setCurrentSongList: (songs: Song[]) => void) => {
  browserApi.storage.local.get([LAST_PLAY_LIST], async function (result) {
    const lastPlayList = result[LAST_PLAY_LIST] as Song[] | undefined;
    if (lastPlayList && lastPlayList.length !== 0) {
      setCurrentSongList(lastPlayList.map((v: any) => Song.hydrate(v)));
      return;
    }

    const defaultSongList = await getSongList(DEFAULT_BVID);
    setCurrentSongList(defaultSongList);
  });
};

/** 从 VideoInfo 构建 Song 列表（单视频或多 P 视频） */
const videoInfoToSongs = (info: VideoInfoLike, bvid: string): Song[] => {
  if (info.pages.length === 1) {
    return [
      Song.withLazySrc({
        cid: String(info.pages[0].cid),
        bvid,
        name: info.title,
        singer: info.uploader.name,
        singerId: info.uploader.mid,
        cover: '',
      }),
    ];
  }

  return info.pages.map(
    (page) =>
      Song.withLazySrc({
        cid: String(page.cid),
        bvid,
        name: page.part,
        singer: info.uploader.name,
        singerId: info.uploader.mid,
        cover: '',
      }),
  );
};

export const getSongList = async (bvid: string): Promise<Song[]> => {
  const info = (await bilibiliApi.fetchVideoInfo(bvid)) as VideoInfoLike | undefined;
  if (!info) return [];
  return videoInfoToSongs(info, bvid);
};

const getSongsFromBVids = async (infos: (VideoInfoLike | undefined)[], strict = false): Promise<Song[]> => {
  if (strict && infos.some((info) => !info)) {
    throw new Error('Failed to load the complete source playlist.');
  }

  return infos.reduce<Song[]>((songs, info) => {
    if (!info) return songs;
    return songs.concat(videoInfoToSongs(info, info.pages[0]?.bvid || ''));
  }, []);
};

const groupSongsByBvid = (songs: SongLike[] = []): Map<string, Song[]> => {
  const grouped = new Map<string, Song[]>();

  songs.forEach((song) => {
    const bvid = String(song?.bvid || '');
    if (!bvid) return;
    if (!grouped.has(bvid)) {
      grouped.set(bvid, []);
    }
    grouped.get(bvid)?.push(song as Song);
  });

  return grouped;
};

/**
 * 批量获取 BVID 对应的歌曲信息。
 * 具备容错性：如果某个视频加载失败（如已删除、私有、或因 MCDN 节点导致 404），会跳过该视频而不会中断整体流程。
 */
const fetchSongsByBvidMap = async (bvids: string[]): Promise<Map<string, Song[]>> => {
  const uniqueBvids = Array.from(new Set(bvids.filter(Boolean)));
  const entries = await Promise.all(
    uniqueBvids.map(async (bvid) => {
      // 捕获单个视频的加载错误，防止一处失败导致全部失败
      const songs = await getSongList(bvid).catch(() => []);
      return [bvid, songs] as const;
    }),
  );

  // 只保留成功加载的视频数据
  return new Map(entries.filter(([, songs]) => songs.length > 0));
};

/** 按 BVID 顺序展平歌曲（跳过缺失项） */
const flattenByOrder = (orderedBvids: string[], byBvid: Map<string, Song[]>): Song[] => {
  const songs: Song[] = [];
  for (const bvid of orderedBvids) {
    const matchedSongs = byBvid.get(bvid);
    if (matchedSongs?.length) {
      songs.push(...matchedSongs);
    }
  }
  return songs;
};

/**
 * 根据来源 BVID 列表重新构建歌单。
 * 具备容错性：跳过无法从本地或远程获取的失效视频。
 */
const rebuildSongsFromSourceBvids = async (sourceBvids: string[], existingSongs: SongLike[] = []): Promise<Song[]> => {
  const orderedBvids = sourceBvids.map((bvid) => String(bvid || '')).filter(Boolean);
  const existingByBvid = groupSongsByBvid(existingSongs);
  const missingBvids = Array.from(new Set(orderedBvids.filter((bvid) => !(existingByBvid.get(bvid)?.length))));
  const fetchedByBvid = missingBvids.length ? await fetchSongsByBvidMap(missingBvids) : new Map<string, Song[]>();

  const resolvedByBvid = new Map<string, Song[]>([...existingByBvid, ...fetchedByBvid]);
  return flattenByOrder(orderedBvids, resolvedByBvid);
};

const getSourceOrderedBvids = async (source: SearchSource): Promise<string[]> => {
  switch (source.type) {
    case 'bvid':
      return [source.bvid];
    case 'fav':
      return bilibiliApi.fetchFavBvids(source.mid);
    case 'series':
      return bilibiliApi.fetchBiliSeriesBvids(source.mid, source.sid);
    case 'collection':
      return bilibiliApi.fetchBiliColleBvids(source.mid, source.sid);
    default:
      return [];
  }
};

export const refreshSongsFromSource = async (
  source: SearchSource,
  existingSongs: SongLike[] = [],
  onProgress?: (progress: RefreshProgress) => void,
): Promise<RefreshFromSourceResult> => {
  const sourceBvids = (await getSourceOrderedBvids(source)).map((bvid) => String(bvid || '')).filter(Boolean);
  const orderedUniqueBvids = Array.from(new Set(sourceBvids));
  const total = orderedUniqueBvids.length;
  const existingByBvid = groupSongsByBvid(existingSongs);
  const resolvedByBvid = new Map<string, Song[]>();
  const failedBvids: string[] = [];
  let processed = 0;

  onProgress?.({ processed, total, failedCount: 0 });

  for (const bvid of orderedUniqueBvids) {
    const existingGroup = existingByBvid.get(bvid);
    if (existingGroup?.length) {
      resolvedByBvid.set(bvid, existingGroup);
    } else {
      const fetchedSongs = await getSongList(bvid).catch(() => []);
      if (fetchedSongs.length) {
        resolvedByBvid.set(bvid, fetchedSongs);
      } else {
        failedBvids.push(bvid);
      }
    }
    processed += 1;
    onProgress?.({ processed, total, failedCount: failedBvids.length });
  }

  return {
    songs: flattenByOrder(orderedUniqueBvids, resolvedByBvid),
    processed,
    total,
    failedCount: failedBvids.length,
    failedBvids,
  };
};

export const getBiliSeriesList = async (mid: string, sid: string): Promise<Song[]> => {
  return getSongsFromBVids(await bilibiliApi.fetchBiliSeriesInfo(mid, sid));
};

export const getFavList = async (mid: string): Promise<Song[]> => {
  return getSongsFromBVids(await bilibiliApi.fetchFavList(mid));
};

export const getBiliColleList = async (mid: string, sid: string, favList: string[] = []): Promise<Song[]> => {
  return getSongsFromBVids(await bilibiliApi.fetchBiliColleList(mid, sid, favList));
};

export const getSongsFromSource = async (source: SearchSource, existingSongs: SongLike[] = []): Promise<Song[]> => {
  switch (source.type) {
    case 'bvid':
      {
        const songs = await getSongList(source.bvid);
        if (!songs.length) {
          throw new Error('Failed to load the source video.');
        }
        return songs;
      }
    case 'fav':
      return rebuildSongsFromSourceBvids(await bilibiliApi.fetchFavBvids(source.mid), existingSongs);
    case 'series':
      return rebuildSongsFromSourceBvids(await bilibiliApi.fetchBiliSeriesBvids(source.mid, source.sid), existingSongs);
    case 'collection':
      return rebuildSongsFromSourceBvids(await bilibiliApi.fetchBiliColleBvids(source.mid, source.sid), existingSongs);
    default:
      return [];
  }
};
