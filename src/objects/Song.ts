import { bilibiliApi } from '../api/bilibili/BilibiliApiClient';

export interface SongProps {
    cid: string;
    bvid: string;
    name: string;
    singer: string;
    cover: string;
    musicSrc: string | (() => Promise<string>);
    singerId: string | number;
    lyric?: string;
    lyricOffset?: number;
}

export default class Song {
    public id: string;
    public bvid: string;
    public name: string;
    public singer: string;
    public singerId: string | number;
    public cover: string;
    public musicSrc: string | (() => Promise<string>);
    public lyric?: string;
    public lyricOffset?: number;

    constructor({ cid, bvid, name, singer, cover, musicSrc, singerId, lyric, lyricOffset }: SongProps) {
        this.id = cid;
        this.bvid = bvid;
        this.name = name;
        this.singer = singer;
        this.singerId = singerId;
        this.cover = cover;
        this.musicSrc = musicSrc;
        this.lyric = lyric;
        this.lyricOffset = lyricOffset;
    }

    /** 创建 Song 并自动挂载延迟解析的 musicSrc */
    static withLazySrc(props: Omit<SongProps, 'musicSrc'>): Song {
        return new Song({
            ...props,
            musicSrc: () => bilibiliApi.resolvePlayUrlWithCache(props.bvid, props.cid),
        });
    }

    /** 从存储数据（id = cid）反序列化并挂载 musicSrc */
    static hydrate(raw: { id: string; bvid: string; name: string; singer: string; singerId?: string | number; cover?: string; lyric?: string; lyricOffset?: number }): Song {
        return Song.withLazySrc({
            cid: String(raw.id),
            bvid: raw.bvid,
            name: raw.name,
            singer: raw.singer,
            singerId: raw.singerId ?? '',
            cover: raw.cover || '',
            lyric: raw.lyric,
            lyricOffset: raw.lyricOffset,
        });
    }
}
